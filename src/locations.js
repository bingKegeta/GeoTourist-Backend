import { MongoClient, ObjectId } from 'mongodb';
import { getAverageTemperature, getClimate, getElevation, getPopulationDensity } from './helper.js';
import './loadenv.js';

const uri = process.env.MONGO_URI;
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
                "climate_zone": climate[1]
            };
            await locations.insertOne(query);
            return 'Success';
        }
    } catch (error) {
        console.error("Error adding location", error);
        return 'Failure!';
    } finally {
        // await client.close();
    }
};

export const QueryLocations = async (user_id) => {
    try {
        const db = client.db('geodb');
        const locations = db.collection('locations');

        const query = await locations.find({user_id}).toArray();

        //* Mapping the data to the specific graphQL shape since mongodb points don't convert to
        //* a graphQL Object
        locationsArr = query.map(item => {
            return {
              user_id: item.user_id,
              name: item.name,
              location: {
                latitude: item.location.coordinates[1], // Latitude at 1
                longitude: item.location.coordinates[0] // Longitude at 0
              },
              elevation: item.elevation,
              average_temperature: item.avg_temp,
              kopen_climate: item.koppen,
              zone_description: item.climate_zone
            };
        });

        return locationsArr;
    } catch (error) {
        console.error(error);
    }
};

export const QueryLocationsByName = async (user_id, name) => {
    try {
        const db = client.db('geodb');
        const locations = db.collection('locations');

        const query = {};
        query['name'] = new RegExp(name, 'i');

        const mongo_query = await locations.find({$and: [{user_id: user_id}, query]}).toArray();
        locationsArr = mongo_query.map(item => {
            return {
              user_id: item.user_id,
              name: item.name,
              location: {
                latitude: item.location.coordinates[1], // Latitude at 1
                longitude: item.location.coordinates[0] // Longitude at 0
              },
              elevation: item.elevation,
              average_temperature: item.avg_temp,
              kopen_climate: item.koppen,
              zone_description: item.climate_zone
            };
        });
    } catch (error) {
        console.error(error);
    } finally {
        return locationsArr;
    }
}

export const UpdateLocation = async (_id, updatedData) => {
    try {
        const db = client.db('geodb');
        const locations = db.collection('locations');

        const longitude = updatedData.location.coordinates[0];
        const latitude = updatedData.location.coordinates[1];

        const elevation = await getElevation(latitude, longitude);
        const avg_temp = await getAverageTemperature(latitude, longitude);
        const climate = await getClimate(latitude, longitude);

        updatedData.elevation = elevation;
        updatedData.avg_temp = avg_temp;
        updatedData.koppen = climate[0];
        updatedData.climate_zone = climate[1];

        location = await locations.findOneAndUpdate(
            {_id: new ObjectId(_id)},
            { $set: updatedData },
            { returnDocument: 'after' }
        );
    } catch (error) {
        console.error(error);
    } finally {
        return location;
    }
}

export const DeleteLocation = async (_id) => {
    try {
        const db = client.db('geodb');
        const locations = db.collection('locations');

        location = await locations.deleteOne({_id: new ObjectId(_id)});
        location = (location.deletedCount > 0) ? 'Success' : 'Failure';
    } catch (error) {
        console.error(error);
    } finally {
        return location;
    }
}