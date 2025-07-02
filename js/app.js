let weatherData = {};
        let isCelsius = false;
        let currentLocation = '';
        
        // Set current date
        document.getElementById('currentDate').textContent = new Date().toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
        
        function handleKeyPress(event) {
            if (event.key === 'Enter') {
                getWeatherForecast();
            }
        }
        
        async function getWeatherForecast() {
            const location = document.getElementById('locationInput').value.trim();
            if (!location) {
                showError('Please enter a location');
                return;
            }
            
            showLoading(true);
            hideError();
            
            try {
                // First get coordinates from the location
                const coordinates = await getCoordinates(location);
                currentLocation = location;
                
                // Then get weather data from NWS API
                const forecastData = await getWeatherData(coordinates.lat, coordinates.lon);
                
                // Display the weather data
                displayWeatherForecast(forecastData, location);
                
                // Show location info
                document.getElementById('locationName').textContent = location;
                document.getElementById('locationInfo').style.display = 'block';
                
            } catch (error) {
                console.error('Error:', error);
                showError(error.message || 'Failed to fetch weather data. Please try again.');
            } finally {
                showLoading(false);
            }
        }
        
        async function getCoordinates(location) {
            const cityCoordinates = {
                'natchez, ms': { lat: 31.5603, lon: -91.4032 },
            };
            
            const key = location.toLowerCase();
            if (cityCoordinates[key]) {
                return cityCoordinates[key];
            } else {
                throw new Error('Location not found. Please try a major US city in the format "City, State" (e.g., "New York, NY")');
            }
        }
        
        async function getWeatherData(lat, lon) {
            try {
                // Get the forecast office and grid coordinates
                const pointResponse = await fetch(`https://api.weather.gov/points/${lat},${lon}`);
                if (!pointResponse.ok) {
                    throw new Error('Unable to get weather data for this location');
                }
                
                const pointData = await pointResponse.json();
                
                // Get the forecast
                const forecastResponse = await fetch(pointData.properties.forecast);
                if (!forecastResponse.ok) {
                    throw new Error('Unable to fetch forecast data');
                }
                
                const forecastData = await forecastResponse.json();
                
                // Try to get current conditions
                let currentWeather = null;
                try {
                    const stationsResponse = await fetch(pointData.properties.observationStations);
                    if (stationsResponse.ok) {
                        const stationsData = await stationsResponse.json();
                        if (stationsData.features && stationsData.features.length > 0) {
                            const stationUrl = stationsData.features[0].id;
                            const observationResponse = await fetch(`${stationUrl}/observations/latest`);
                            if (observationResponse.ok) {
                                currentWeather = await observationResponse.json();
                            }
                        }
                    }
                } catch (e) {
                    console.log('Could not fetch current weather data');
                }
                
                weatherData = {
                    forecast: forecastData.properties.periods,
                    current: currentWeather
                };
                
                return weatherData;
                
            } catch (error) {
                throw new Error('Failed to fetch weather data from National Weather Service');
            }
        }
        
        function displayWeatherForecast(data, location) {
            const forecastContainer = document.getElementById('forecastContainer');
            const periods = data.forecast.slice(0, 14); // Get 14 periods (7 days with day/night)
            
            // Display current weather if available
            if (data.current && data.current.properties) {
                displayCurrentWeather(data.current.properties);
            }
            
            forecastContainer.innerHTML = '';
            
            // Group periods by day (combine day and night)
            const days = [];
            for (let i = 0; i < periods.length; i += 2) {
                const dayPeriod = periods[i];
                const nightPeriod = periods[i + 1];
                
                if (dayPeriod) {
                    days.push({
                        name: dayPeriod.name,
                        day: dayPeriod,
                        night: nightPeriod
                    });
                }
            }
            
            // Take only 7 days
            days.slice(0, 7).forEach((dayData, index) => {
                const card = createWeatherCard(dayData, index);
                forecastContainer.appendChild(card);
            });
        }
        
        function displayCurrentWeather(current) {
            const currentWeatherDiv = document.getElementById('currentWeather');
            const currentTemp = document.getElementById('currentTemp');
            const currentDescription = document.getElementById('currentDescription');
            const currentDetails = document.getElementById('currentDetails');
            const currentIcon = document.getElementById('currentIcon');
            
            if (current.temperature && current.temperature.value !== null) {
                const temp = convertTemperature(current.temperature.value, true); // API returns Celsius
                currentTemp.textContent = `${Math.round(temp)}°${isCelsius ? 'C' : 'F'}`;
                
                currentDescription.textContent = current.textDescription || 'Current conditions';
                
                const details = [];
                if (current.relativeHumidity && current.relativeHumidity.value) {
                    details.push(`Humidity: ${Math.round(current.relativeHumidity.value)}%`);
                }
                if (current.windSpeed && current.windSpeed.value) {
                    const windSpeed = Math.round(current.windSpeed.value * 2.237); // Convert m/s to mph
                    details.push(`Wind: ${windSpeed} mph`);
                }
                currentDetails.textContent = details.join(' • ');
                
                // Set a generic weather icon since NWS doesn't always provide current condition icons
                currentIcon.src = 'https://api.weather.gov/icons/land/day/few?size=medium';
                currentIcon.alt = 'Current weather';
                
                currentWeatherDiv.style.display = 'block';
            }
        }
        
        function createWeatherCard(dayData, index) {
            const col = document.createElement('div');
            col.className = 'col-lg-3 col-md-4 col-sm-6 mb-4';
            
            const day = dayData.day;
            const night = dayData.night;
            
            // Get high and low temperatures
            let highTemp = day.temperature;
            let lowTemp = night ? night.temperature : null;
            
            // Ensure high is higher than low
            if (lowTemp && highTemp < lowTemp) {
                const temp = highTemp;
                highTemp = lowTemp;
                lowTemp = temp;
            }
            
            const convertedHigh = convertTemperature(highTemp, day.temperatureUnit === 'F');
            const convertedLow = lowTemp ? convertTemperature(lowTemp, (night ? night.temperatureUnit : day.temperatureUnit) === 'F') : null;
            
            col.innerHTML = `
                <div class="card weather-card h-100">
                    <div class="card-body text-center">
                        <h5 class="day-name">${getDayName(day.name, index)}</h5>
                        <img src="${day.icon}" alt="${day.shortForecast}" class="weather-icon mb-3">
                        <div class="temperature mb-2">
                            ${Math.round(convertedHigh)}°${isCelsius ? 'C' : 'F'}
                            ${convertedLow ? ` / ${Math.round(convertedLow)}°${isCelsius ? 'C' : 'F'}` : ''}
                        </div>
                        <p class="weather-description">${day.shortForecast}</p>
                        <small class="text-muted">${day.detailedForecast.substring(0, 80)}${day.detailedForecast.length > 80 ? '...' : ''}</small>
                    </div>
                </div>
            `;
            
            return col;
        }
        
        function getDayName(name, index) {
            if (index === 0) return 'Today';
            if (index === 1) return 'Tomorrow';
            
            // Extract day name from period name
            const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
            const today = new Date().getDay();
            const targetDay = (today + index) % 7;
            return dayNames[targetDay];
        }
        
        function convertTemperature(temp, isFromFahrenheit) {
            if (isCelsius && isFromFahrenheit) {
                return (temp - 32) * 5/9;
            } else if (!isCelsius && !isFromFahrenheit) {
                return temp * 9/5 + 32;
            }
            return temp;
        }
        
        function toggleTemperatureUnit() {
            isCelsius = !isCelsius;
            document.getElementById('tempUnit').textContent = isCelsius ? '°F' : '°C';
            
            // Refresh the display with new temperature unit
            if (weatherData.forecast) {
                displayWeatherForecast(weatherData, currentLocation);
            }
        }
        
        function showLoading(show) {
            const spinner = document.querySelector('.loading-spinner');
            spinner.style.display = show ? 'block' : 'none';
        }
        
        function showError(message) {
            const errorDiv = document.getElementById('errorMessage');
            const errorText = document.getElementById('errorText');
            errorText.textContent = message;
            errorDiv.style.display = 'block';
        }
        
        function hideError() {
            document.getElementById('errorMessage').style.display = 'none';
        }
        
        // Initialize with a default location (optional)
        window.addEventListener('DOMContentLoaded', function() {
            // You can set a default location here if desired
            // document.getElementById('locationInput').value = 'New York, NY';
            // getWeatherForecast();
        });