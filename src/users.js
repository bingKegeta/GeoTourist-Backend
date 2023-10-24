import { MongoClient } from 'mongodb';

// the closing of the connection is moved to an unreachable section since it wasn't working for some reason previously
//! It's definitely bad practice that we're going to make better

const uri = 'mongodb://localhost:27017';
const client = new MongoClient(uri);
let usersArr, user, newUser;

export const QueryUsers = async function()
{
    try
    {
        const db = client.db('geodb');
        const users = db.collection('users');
        usersArr = await users.find({}).toArray();
        

        // Query for a user with the name Ryan
        // const query = { "name": { $regex: "Ryan"}};
        // const user = await users.findOne(query);

        // console.log(user);
    }
    finally
    {
        return usersArr;
    }
    await client.close();
}

export const FindUser = async function(email, username, password)
{
    try
    {
        const db = client.db('geodb');
        const users = db.collection('users');

        const query = {
            "email": new RegExp('^' + email + '$'),
            "username": new RegExp('^' + username + '$'),
            "password": new RegExp('^' + password + '$')
        };
        // const query = { "username": { $regex: username}};
        // const query = { "username": new RegExp(username)};

        user = await users.findOne(query);
    }
    finally
    {
        return user;
    }
    await client.close();
}

export const FindUsersByField = async function (field, value) {
    try {
        const db = client.db('geodb');
        const usersCollection = db.collection('users');

        const query = {};
        query[field] = { $regex: new RegExp(value, 'i') }; // Use case-insensitive regex for partial matches

        usersArr = await usersCollection.find(query).toArray();
    } catch (error) {
        console.error("Error finding users:", error);
    } finally {
        return usersArr;
    }
    await client.close();
};


export const AddUser = async function(email, username, password)
{
    try
    {
        const db = client.db('geodb');
        const users = db.collection('users');

        const doc = {
            "email": email,
            "username": username,
            "password": password
        };
        await users.insertOne(doc);

        const query = {
            "email": new RegExp('^' + email + '$'),
            "username": new RegExp('^' + username + '$'),
            "password": new RegExp('^' + password + '$')
        };
        newUser = await users.findOne(query);
    }catch (error) {
        console.log("Error adding user:", error);
    }
    finally
    {
        return newUser;
    }
    await client.close();
}