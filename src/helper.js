import axios from "axios";
import "./loadenv.js";
import { exec, spawn } from 'child_process';

const WEATHER_API_KEY = process.env.WEATHER_API_KEY;
const weatherURL = process.env.WEATHER_API_URI;
const elevationEndpoint = process.env.ELEVATION_URI;
const CLIMATE_URI = process.env.CLIMATE_URI;

// takes array of mongo locations
export const mapLocationMongoToGraphQL = (query) => {
  return query.map((item) => {
    return {
      _id: item._id,
      user_id: item.user_id,
      name: {
        display: item.name.display,
        street: item.name.street ? item.name.street : "",
        city: item.name.city ? item.name.city : "",
        country: item.name.country ? item.name.country : "",
        address: item.name.address ? item.name.address : "",
        postal: item.name.postal ? item.name.postal : "",
      },
      location: {
        latitude: item.location.coordinates[1], // Latitude at 1
        longitude: item.location.coordinates[0], // Longitude at 0
      },
      elevation: item.elevation,
      avg_temp: item.avg_temp,
      trewartha: item.trewartha,
      climate_zone: item.climate_zone,
    };
  });
};

// takes a single location in graphql and turns it into mongo
export const mapLocationGraphQLToMongo = (input) => {
  return {
    name: input.name,
    location: {
      type: "Point",
      coordinates: [input.location.longitude, input.location.latitude],
    },
    elevation: input.elevation,
    avg_temp: input.avg_temp,
    trewartha: input.trewartha,
    climate_zone: input.climate_zone,
  };
};

export const generateAuthToken = (user) => {
  return user._id;
};

export const getElevation = async (latitude, longitude) => {
  const endpoint = `${elevationEndpoint}locations=${latitude},${longitude}`;

  try {
    const response = await axios.get(endpoint);
    const elevation = response.data.results[0].elevation;
    return elevation;
  } catch (error) {
    console.error("Failed to retrieve elevation data", error);
    throw new Error("Failed to retrieve elevation data");
  }
};

//! Need to find an API or some other method to get this information
export const getPopulationDensity = async (latitude, longitude) => {};

export const getAverageTemperature = async (latitude, longitude) => {
  const exclude = "current,minutely,hourly,alerts";
  const endpoint = `${weatherURL}lat=${latitude}&lon=${longitude}&appid=${WEATHER_API_KEY}`;

  try {
    const response = await axios.get(endpoint);
    const avg_temp =
      (response.data.main.temp_min + response.data.main.temp_max) / 2;
    return avg_temp;
  } catch (error) {
    console.error("Failed to retrieve weather data", error);
    throw new Error("Failed to retrieve weather data");
  }
};

export const getClimate = async (latitude, longitude) => {
  const endpoint = `${CLIMATE_URI}lat=${latitude}&lon=${longitude}`;

  try {
    const response = await axios.get(endpoint);
    // console.log(response.data.data);
    const data = response.data.data[response.data.data.length - 1];
    const trewarthaCode = data.code;
    const climateDesc = data.text;

    return [trewarthaCode, climateDesc];
  } catch (error) {
    console.error("Failed to retreive climate data", error);
    throw new Error("Failed to retrieve climate data");
  }
};

export const recommendLocs = async (user_id, num_recommendations) => {
  let locationsArr = [];
  const pythonProcess = spawn('python3', ['./location-suggest/random-forest/model.py', '--user_id', user_id, '--num_recommendations', num_recommendations]);
  let pythonOutput = '';

  // Collect Python output
  pythonProcess.stdout.on('data', (data) => {
      pythonOutput += data.toString();
      console.log(data);
  });
  
  // Handle Python process termination
  pythonProcess.on('close', (code) => {
      console.log(`Python process exited with code ${code}`);
      // Parse the collected output as JSON (assuming the Python script prints a JSON string)
      let jsonResponse;
      try {
          jsonResponse = JSON.parse(pythonOutput);
      } catch (error) {
          console.error('Error parsing JSON:', error.message);
          jsonResponse = { error: 'Failed to parse JSON output from Python script' };
      }
      if ("Prediction" in jsonResponse) {
          locationsArr = jsonResponse["Prediction"];
      }
      else {
          console.log(jsonResponse);
      }
      return locationsArr;
    });
    return locationsArr;
}