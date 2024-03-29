// The DataController module implements API to interact with database.

const logger = require('../utils/Logger');
try {
  const mongoose = require('mongoose');
  const fs = require('fs');
  const readline = require('readline');

  const cfg = require('../../config/default');

  const PostalCodeEntry = require('../models/PostalCodeEntry');
  const FeedbackEntry = require('../models/FeedbackEntry');

  mongoose.connect(cfg.mongodb.connectionURI, {useNewUrlParser: true}).then(
    () => { logger.info('Connected to mongoDB successfully') },
    err => { logger.error('Failed to connect to mongoDB: ', err) }
  );

  // Searches database for text.
  // The `searchKeys` obect must contain text fields, keys doesn't matter.
  // Returns an array of 20 PostalCodeEntry objects that match the best.
  function search(searchKeys) {
    try {
      if(!searchKeys) throw new Error('No arguments given.');

      var searchString = generateSearchString(searchKeys);

      return PostalCodeEntry.find(
        { $text: { $search: searchString } },
        { score: { $meta: "textScore" } }
      ) .sort( { score: { $meta: "textScore" } } )
        .limit(20)
        .exec();
    } catch (err) {
      logger.error('Unexpected error at ' + __filename + ' while trying to serach: ', err);
    }
  }

  // Helper function for `search` function.
  // The `searchKeys` argument must be an object.
  function generateSearchString(searchKeys) {
    try {
      if(!searchKeys) throw new Error('No arguments given.');

      var searchString = '';
      for(let key in searchKeys) {
        searchString += ' ' + searchKeys[key];
      }

      return searchString;
    } catch (err) {
      logger.error('Unexpected error at ' + __filename + ' while trying to generate search string: ', err);
    }
  }

  // Inserts one or many PostalCodeEntry objects to MongoDB.
  //
  // The structure of `postalCodeEntry` object must correspond to PostalCodeEntry model.
  // `postalCodeEntry` must be an array if insertMany === true.
  function insertPostalCode(postalCodeEntry, insertMany = false) {
    try {
      if(!postalCodeEntry) throw new Error('No argument given.');

      if(insertMany) {
        return insertManyPostalCode(postalCodeEntry);
      } 
      return insertOnePostalCode(postalCodeEntry);
    } catch(err) {
      logger.error('Unexpected error at ' + __filename + ' while inserting postal code: ', err);
    }
  }

  // Inserts a batch of PostalCodeEntry into databse.
  // The `postalCodeEntryArr` argument is an array of objects which correspond to PostalCodeEntry model.
  function insertManyPostalCode(postalCodeEntryArr) {
    try {
      // If given not array
      if(!postalCodeEntryArr || (postalCodeEntryArr && !postalCodeEntryArr.length))
        throw new Error('The given argument is not an array');

      return PostalCodeEntry.insertMany(postalCodeEntryArr, function(err) {
        if(err) logger.error('Unable to insert many PostalCodeEntry: ', err);
        else logger.info('Inserted many PostalCodeEntry successfully.');
      });
    } catch (err) {
      logger.error('Unexpecter error at ' + __filename + ' while trying to insertManyPostalCode: ', err);
    }
  }

  // Inserts PostalCodeEntry into database.
  // The `postalCodeEntry` argument must correspond with PostalCodeEntry model.
  function insertOnePostalCode(postalCodeEntry) {
    try {
      if(!postalCodeEntry) 
        throw new Error('No argument given.');

      return PostalCodeEntry.create({
        countryCode: postalCodeEntry.countryCode,
        postalCode: postalCodeEntry.postalCode,
        placeName: postalCodeEntry.placeName,
        adminName1: postalCodeEntry.adminName1,
        adminName2: postalCodeEntry.adminName2
      }, function (err, postalCode) {
        if (err) logger.error('Unable to insert one PostalCodeEntry: ', err);
        else {
          logger.info('Inserted one PostalCodeEntry successfully.');
          logger.debug('The inserted PostalCode object: ', postalCode);
        } 
      });
    } catch (err) {
      logger.error('Unexpected error at ' + __filename + ' while inserting one postal code: ', err);
    }
  }

  // Imports PostalCodeEntry objects to database from UTF-8 text file with fields separated with tabs.
  function _importPostalCodeEntryFromFile(pathToFile) {
    try {
      if(!pathToFile) throw new Error('No argument given.');
      if(!fs.existsSync(pathToFile)) throw new Error("File doesn't exist.");

      const fileStream = fs.createReadStream(pathToFile, {encoding: 'utf-8'});
      const rl = readline.createInterface({
        input: fileStream
      });

      // Determines a number of documents sent to database per request.
      const BATCH_SIZE = 1024;

      var batch = [];

      rl.on('line', async line => {
        const data = line.split('\t');
        const postalCodeEntry = {
          countryCode: data[0],
          postalCode: data[1],
          placeName: data[2],
          adminName1: data[3],
          adminName2: data[5]
        };
        batch.push(postalCodeEntry);

        if(batch.length >= BATCH_SIZE) {
          const temp = batch;
          batch = [];
          await insertManyPostalCode(temp);
        }
      });

      rl.on('close', async () => {
        if(batch.length !== 0) {
          const temp = batch;
          batch = [];
          await insertManyPostalCode(temp);
        }
        logger.info('Importing many PostalCodeEntry finished successfully.');
      });
      
    } catch (err) {
      logger.error('Unexpected error at ' + __filename + ' while trying to import postal code entry from file: ', err);
    }
  }

  module.exports = {
    search,
    insertPostalCode,
    insertOnePostalCode,
    insertManyPostalCode,
    _importPostalCodeEntryFromFile
  }
} catch (e) {
  logger.error('Unexpected error at ' + __filename + ': ', e);
}
