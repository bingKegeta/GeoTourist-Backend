import axios from 'axios';
import './loadenv.js';

const WEATHER_API_KEY = process.env.WEATHER_API_KEY;
const weatherURL = process.env.WEATHER_API_URI;
const elevationEndpoint = process.env.ELEVATION_URI;
const CLIMATE_URI = process.env.CLIMATE_URI;

export const generateAuthToken = (user) => { return user._id; }

export const getElevation = async (latitude, longitude) => {
    const endpoint = `${elevationEndpoint}locations=${latitude},${longitude}`;

    try {
        const response = await axios.get(endpoint);
        const elevation = response.data.results[0].elevation;
        return elevation;
    } catch (error) {
        console.error('Failed to retrieve elevation data', error);
        throw new Error('Failed to retrieve elevation data');
    }
};

//! Need to find an API or some other method to get this information
export const getPopulationDensity = async (latitude, longitude) => {
    
}

export const getAverageTemperature = async (latitude, longitude) => {
    const exclude = 'current,minutely,hourly,alerts';
    const endpoint = `${weatherURL}lat=${latitude}&lon=${longitude}&appid=${WEATHER_API_KEY}`;

    try {
        const response = await axios.get(endpoint);
        const avg_temp = (response.data.main.temp_min + response.data.main.temp_max) / 2;
        return avg_temp;
    } catch (error) {
        console.error('Failed to retrieve weather data', error);
        throw new Error('Failed to retrieve weather data');
    }
}

export const getClimate = async (latitude, longitude) => {
    const endpoint = `${CLIMATE_URI}lat=${latitude}&lon=${longitude}`;

    try {
        const response = await axios.get(endpoint);
        const data = response.data.data[0];
        const koppenCode = data.code;
        const climateDesc = data.text;

        return [koppenCode, climateDesc];
    } catch (error) {
        console.error('Failed to retreive climate data', error);
        throw new Error('Failed to retrieve climate data');
    }
}