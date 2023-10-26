import { MongoClient } from 'mongodb';
import { getAverageTemperature, getClimate, getElevation, getPopulationDensity } from './helper.js';
import './loadenv.js';

const uri = process.env.uri;
const client = new MongoClient(uri);

let locationsArr, location, newLocation;

export const addLocation = async function (user_id, name, latitude, longitude) {
    try {
        const db = client.db('geodb');
        const locations = db.collection('locations');
        
        // Define a 2dsphere geospatial index on the 'location' field
        await locations.createIndex({ location: '2dsphere' });

        location = await locations.findOne({
            $and: [
                { user_id: user_id },
                {
                    location: {
                        $nearSphere: {
                            $geometry: {
                                type: 'Point',
                                coordinates: [longitude, latitude],
                            },
                            $maxDistance: 5000, // 5 km radius for same place flagging
                        },
                    },
                },
            ],
        });

        if (location) {
            throw new Error('Close by Location already added');
        } else {
            const elevation = await getElevation(latitude, longitude);
            // const population_density = await getPopulationDensity(latitude, longitude);
            const avg_temp = await getAverageTemperature(latitude, longitude);
            const climate = await getClimate(latitude, longitude);

            const query = {
                "user_id": user_id,
                "name": name,
                "location": {
                    type: "Point",
                    coordinates: [longitude, latitude],
                },
                "elevation": elevation,
                // "population_density": population_density,
                "avg_temp": avg_temp,
                "koppen": climate[0],
                "climate zone": climate[1]
            };
            await locations.insertOne(query);
            return 'Success';
        }
    } catch (error) {
        console.error("Error adding location", error);
        return 'Failure!';
    } finally {
        await client.close();
    }
};
