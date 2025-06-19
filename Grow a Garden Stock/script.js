        // Función para obtener la ruta de la imagen, asumiendo nombres de archivo como 'ItemName.png'
        function getImagePath(itemName) {
            // Se asume que las imágenes están en una carpeta 'img/' relativa al HTML
            // Si no tienes las imágenes locales, puedes usar un placeholder temporal como este:
            // return `https://placehold.co/100x100/A0DC9D/2C5E2E?text=${itemName.substring(0, 3)}`;
            return `img/${itemName}.png`;
        }

        // Función para parsear la cadena de cuenta regresiva (ej. "00h 11m 58s" o "01m 58s") a segundos totales
        function parseCountdownToSeconds(countdownString) {
            // Esta expresión regular captura opcionalmente horas (Xh), luego minutos (Ym) y segundos (Zs).
            // Grupo 1: horas (opcional)
            // Grupo 2: minutos
            // Grupo 3: segundos
            const match = countdownString.match(/(?:(\d+)h\s*)?(\d+)m\s*(\d+)s/);

            if (match) {
                const hours = parseInt(match[1] || '0', 10);
                const minutes = parseInt(match[2], 10);
                const seconds = parseInt(match[3], 10);

                console.log(`Parsed: Hours: ${hours}, Minutes: ${minutes}, Seconds: ${seconds}`);
                return (hours * 3600) + (minutes * 60) + seconds;
            }
            console.warn(`No se pudo parsear la cadena de cuenta regresiva: "${countdownString}". Devolviendo 0 segundos.`);
            return 0;
        }

        // --- FUNCIONES PARA CARGAR CADA CATEGORÍA INDEPENDIENTEMENTE ---

        async function loadCategoryStockAndCountdown(categoryName, stockContainerId, countdownContainerId) {
            const stockItemsContainer = document.getElementById(stockContainerId);
            const countdownContainer = document.getElementById(countdownContainerId);

            if (!stockItemsContainer) {
                console.error(`Error: Elemento con ID '${stockContainerId}' no encontrado en el DOM.`);
                return;
            }

            if (!countdownContainer) {
                console.warn(`Advertencia: Elemento con ID '${countdownContainerId}' no encontrado en el DOM. El tiempo de reabastecimiento para ${categoryName} no se mostrará.`);
            }

            try {
                // --- Cargar datos de stock ---
                const stockResponse = await fetch('https://growagardenapi.vercel.app/api/stock/GetStock');
                if (!stockResponse.ok) {
                    throw new Error(`Error HTTP! estado: ${stockResponse.status} (${stockResponse.statusText}) para GetStock`);
                }
                const apiStockResponse = await stockResponse.json();
                console.log(`Respuesta de la API de Stock COMPLETA:`, apiStockResponse); // Log de la respuesta completa
                console.log(`Respuesta de la API de Stock para Data.${categoryName}:`, apiStockResponse?.Data?.[categoryName]); // Log específico del Data.Category

                // Acceder a los datos de la categoría específica (seeds, gear, egg, cosmetic)
                let categoryData = apiStockResponse?.Data?.[categoryName]; 

                // *** LÓGICA DE CONVERSIÓN ELIMINADA PARA COSMETICS ***
                // Ya no es necesaria, ya que la categoría 'cosmetic' se ha eliminado.
                // Si la lógica para otras categorías fuera similar, se podría aplicar aquí.
                // *** FIN DE LA LÓGICA DE CONVERSIÓN PARA COSMETICS ***

                if (!Array.isArray(categoryData) || categoryData.length === 0) {
                    stockItemsContainer.innerHTML = `<p>No hay productos de ${categoryName} disponibles.</p>`;
                    console.warn(`DEBUG ${categoryName}: La categoría '${categoryName}' está vacía o no es un array después de intentar la conversión.`);
                } else {
                    stockItemsContainer.innerHTML = '';
                    categoryData.forEach(item => {
                        const itemDiv = document.createElement('div');
                        itemDiv.className = 'item'; 

                        const itemImage = document.createElement('img');
                        itemImage.src = getImagePath(item.name);
                        itemImage.alt = item.name;
                        itemImage.classList.add('item-image');

                        const nameHeading = document.createElement('h2');
                        nameHeading.textContent = item.name;

                        const priceParagraph = document.createElement('p');
                        priceParagraph.textContent = `Stock: ${item.stock}`;

                        itemDiv.appendChild(itemImage);
                        itemDiv.appendChild(nameHeading);
                        itemDiv.appendChild(priceParagraph);

                        stockItemsContainer.appendChild(itemDiv);
                    });
                    console.log(`DEBUG ${categoryName}: Se han cargado ${categoryData.length} productos.`);
                }

                // --- Cargar tiempo de reabastecimiento ---
                if (countdownContainer) {
                    const restockResponse = await fetch('https://growagardenapi.vercel.app/api/stock/Restock-Time');
                    if (!restockResponse.ok) {
                        throw new Error(`Error HTTP! estado: ${restockResponse.status} (${restockResponse.statusText}) para Restock-Time`);
                    }
                    const restockApiResponse = await restockResponse.json();
                    console.log(`Respuesta de la API de Restock Time COMPLETA:`, restockApiResponse); // Log de la respuesta completa del tiempo de reabastecimiento

                    // Acceder a la cadena de cuenta regresiva de la categoría específica (desde la raíz de la respuesta)
                    const countdownString = restockApiResponse?.[categoryName]?.countdown; 

                    console.log(`DEBUG ${categoryName}: Cadena de Cuenta Regresiva:`, countdownString);

                    if (countdownString && typeof countdownString === 'string') {
                        let timeLeft = parseCountdownToSeconds(countdownString); 
                        console.log(`DEBUG ${categoryName}: Tiempo restante inicial (segundos):`, timeLeft);

                        const updateCountdown = () => {
                            const minutes = Math.floor(timeLeft / 60);
                            const seconds = Math.floor(timeLeft % 60); // Usar Math.floor aquí también

                            const formattedMinutes = String(minutes).padStart(2, '0');
                            const formattedSeconds = String(seconds).padStart(2, '0');

                            countdownContainer.innerHTML = `Tiempo de reabastecimiento de ${categoryName.charAt(0).toUpperCase() + categoryName.slice(1)}: ${formattedMinutes}:${formattedSeconds}`;

                            if (timeLeft <= 0) {
                                clearInterval(countdownInterval); // Detener el contador actual
                                countdownContainer.innerHTML = `¡${categoryName.charAt(0).toUpperCase() + categoryName.slice(1)} reabastecido!`;
                                
                                // Reiniciar la carga de la categoría después de un breve retraso
                                // Se ha eliminado 'cosmetic' de esta condición.
                                if (['seeds', 'gear', 'egg'].includes(categoryName)) { // Uso de .includes para mayor legibilidad
                                    console.log(`DEBUG ${categoryName}: Reiniciando la carga de stock y cuenta regresiva en breve...`);
                                    setTimeout(() => {
                                        loadCategoryStockAndCountdown(categoryName, stockContainerId, countdownContainerId);
                                    }, 2000); // Retraso de 2 segundos para dar tiempo a la API
                                }

                            } else {
                                timeLeft--;
                            }
                        };

                        updateCountdown(); // Llamar una vez de inmediato
                        const countdownInterval = setInterval(updateCountdown, 1000);

                    } else {
                        countdownContainer.innerHTML = `No se encontró información de tiempo de reabastecimiento para ${categoryName}.`;
                        console.error(`ERROR ${categoryName}: countdownString no es una cadena válida o no se encontró.`, countdownString);
                    }
                }

            } catch (error) {
                console.error(`ERROR CATCH ${categoryName}: Hubo un problema con la operación fetch para ${categoryName}:`, error);
                if (stockItemsContainer) {
                    stockItemsContainer.innerHTML = `<p>Lo sentimos, no pudimos cargar los productos de ${categoryName} en este momento.</p>`;
                }
                if (countdownContainer) {
                    countdownContainer.innerHTML = `Error al cargar el tiempo de reabastecimiento de ${categoryName}.`;
                }
            }
        }

        // Llamar a las funciones para cargar las categorías cuando el DOM esté completamente cargado
        document.addEventListener('DOMContentLoaded', () => {
            loadCategoryStockAndCountdown('seeds', 'seeds-stock-items', 'countdown-seeds');
            loadCategoryStockAndCountdown('gear', 'gear-stock-items', 'countdown-gear');
            loadCategoryStockAndCountdown('egg', 'egg-stock-items', 'countdown-egg');
            // Se ha eliminado la llamada a loadCategoryStockAndCountdown para 'cosmetic'
        });