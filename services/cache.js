const mongoose = require('mongoose')
const redis = require('redis')
const util = require('util')

const redisUrl = 'redis://127.0.0.1:6379'
const client = redis.createClient(redisUrl)
client.hget = util.promisify(client.hget)


const exec = mongoose.Query.prototype.exec;

mongoose.Query.prototype.cache = function ( options ={}) {
    this.useCache = true // this will set useCache value to true. So for same query when used at other places, this property can be used as a check.
    this.hashKey = JSON.stringify(options.key || '')
    
    return this 
    // here we are returning 'this' because we can chain cache() to the query 
    // Blog.find({}).cache().limit(10).sort()
}

mongoose.Query.prototype.exec = async function () {
    // console.log('I am abot')
    // console.log(this.getQuery())
    // console.log(this.mongooseCollection.name)

    if( !this.useCache ) {
        return exec.apply(this, arguments)
    }

    const key = JSON.stringify(Object.assign({} , this.getQuery() , { collection: this.mongooseCollection.name }))
    // Check if we have a value for 'key' in redis
    const cacheValue = await client.hget(this.hashKey, key)

    if(cacheValue) {
         //console.log(cacheValue)
        
         //return JSON.parse(cacheValue) // cacheValue is a JSON, when parsed it converts to javascript object, but it is expected to return mongoose model

         //return new this.model(JSON.parse(cacheValue)) // this works only if cacheValue is object. if it is array of objects, then we need to create model for each object
        
        const doc = JSON.parse(cacheValue)

        return Array.isArray(doc) ? 
            doc.map( d => new this.model(d)) :
            new this.model(doc)
        
    } 
    
    const result = await exec.apply(this, arguments)
    client.hset(this.hashKey, key, JSON.stringify(result))
    // console.log(result)
    return result
}

module.exports = {
    clearHash(hashKey) {
        client.del(JSON.stringify(hashKey))
    }
}