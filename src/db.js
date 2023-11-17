// Abstracts away DB implementation from backend devs.
// Uncomment the below two lines when using MongoDB, and comment out the rest.
// import { MongoClient } from 'mongodb';
// export default MongoClient;
var AWS = require('aws-sdk');
var ddb = new AWS.DynamoDB({ apiVersion: '2012-08-10' });

export default class MongoClient {
    constructor(uri) {
        this.uri = uri;
    }

    db() {
        return this;
    }

    collection(name) {
        return {
            async find(arg) {
                delete params['Key']
                return ddb.scan({
                    TableName: name,
                    ProjectionExpression: 'ATTRIBUTE_NAME'
                });
            },
            async findOne(arg) {
                return ddb.getItem({
                    TableName: name,
                    Key: {
                        'KEY_NAME': { N: arg }
                    }, 
                    ProjectionExpression: 'ATTRIBUTE_NAME'
                });
            }
        };
    }
}
