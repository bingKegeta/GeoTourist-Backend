import { MongoClient } from 'mongodb';

const uri = 'mongodb://localhost';
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
        await client.close();
        return usersArr;
    }
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
        await client.close();
        return user;
    }
}

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
    }
    finally
    {
        await client.close();
        return newUser;
    }
}