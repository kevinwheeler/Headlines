const _ = require('lodash');


let countersColl;
function getCountersColl(db) {
  const prom = new Promise(function(resolve,reject) {
    db.collection('counters', {}, (err, coll) => {
      if (err !== null) {
        reject(err);
      } else {
        countersColl = coll;
        resolve();
      }
    });
  });
  return prom;
}

/*
 *  Returns an incrementing number. Starts the number at 1000 the first time, and then returns 1001, 1002,
 *  during subsequent calls.  Starts at 1000 because it is nice to have some numbers that we know won't be in our database
 *  that we can use as the IDs for sample data, etc.
 */
function getNextId(db, counterName) {
  var nextIdPromise = new Promise(function(resolve, reject) {
    getCountersColl(db).then(function() {
      return countersColl.findOneAndUpdate(
        {_id: counterName},
        {$inc: {seq: 1}},
        {
          returnOriginal: false
        }
      )
    }).then(function(result) {
      if (result.value !== null) {
        resolve(result.value.seq)
      } else {
        countersColl.insertOne(
          {
            _id: counterName,
            seq: 1000
          }
        ).then(function() {
          resolve(1000);
        }).catch(function(err) {
          const duplicateKeyErrorCode = 11000;
          if (err.code === duplicateKeyErrorCode) {
            countersColl.findOneAndUpdate(
              {_id: counterName},
              {$inc: {seq: 1}},
              {
                returnOriginal: false
              }
            ).then(function(result) {
              resolve(result.value.seq);
            }).catch(function(err) {
              reject(err)
            })
          } else {
            reject(err);
          }
        });
      }
    }).catch(function(err) {
      reject(err);
    });
  });

  return nextIdPromise;
}

let imageColl;
function getImageColl(db) {
  const prom = new Promise(function(resolve,reject) {
    db.collection('image', {}, (err, coll) => {
      if (err !== null) {
        reject(err);
      } else {
        imageColl = coll;
        resolve();
      }
    });
  });
  return prom;
}

function joinArticleWithImage(db, article) {
  const prom = new Promise(function(resolve,reject) {
    getImageColl(db).then(function() {
      imageColl.find({
        _id: article.imageId
      }).limit(1).next().then(function(image) {
        if (image === null) {
          reject("Image not found in image collection.");
        } else {
          article.imageWidth = image.width;
          article.imageHeight = image.height;
          article.imageSlug = image.slug;
          resolve();
        }
      });
    })
  });
  return prom;
}

function joinArticleArrayWithImages(db, articles) {
  const prom = new Promise(function(resolve,reject) {
    getImageColl(db).then(function() {

      const imageIDs = articles.map(function (article) {
        return article.imageId;
      });
      imageColl.find({
        _id: {$in: imageIDs}
      }).toArray(
        function (err, images) {
          if (err !== null) {
            reject(err);
          } else {

            const imageIdToImageMap = {};
            for (let i=0; i < images.length; i++) {
              const image = images[i];
              imageIdToImageMap[image._id] = image;
            }

            let success = true;
            let failingImageId;
            let failingArticleId;

            for (let i=0; i < articles.length; i++) {
              const article = articles[i];
              const image = imageIdToImageMap[article.imageId];
              if (image === undefined) {
                failingArticleId = article._id;
                failingImageId = article.imageId;
                success = false;
                break;
              }
              article.imageWidth = image.width;
              article.imageHeight = image.height;
              article.imageSlug = image.slug;
            }
            if (success) {
              resolve();
            } else {
              reject("Failed to find image with id " + failingImageId + " for article with id " + failingArticleId);
            }
          }
        }
      );
    }).catch(function(err) {
      reject(err);
    });
  });
  return prom;
}

const logError = function(err) {
  console.error(err.stack || err);

  // If you pass an error handling function to another function as an async callback, you may have no idea where the error
  // originated from, because the async code runs on a completely different stack frame -- the original
  // stack frame is long gone and thus won't be in the stack trace. So, what we do is we
  // use an inline/lambda function (let's call this function L) and pass that as the async callback argument.
  // From function L we will call logError and logError will call console.trace(). That way the line number
  // of this L will be captured/traced, and we can figure out where the error originated from.
  // Note: We also use this in other cases besides just when passing in a lambda/inline function as an argument/callback
  // to another function. Use it any time you have an error object in your hand that came from a different line of code,
  // and you want the current line of code to be noted/traced.
  console.trace("Caught from:");
}

// Dont send articles to client without projecting first. We don't want people to know the SID of the author, for example.
const publicArticleFieldsProjection = {
  _id: true,
  all_time_views: true,
  approval: true,
  articleURLSlug: true,
  authorId: true,
  authorUrl: true,
  authorName: true,
  category: true,
  daily_views: true,
  dateCreated: true,
  headline: true,
  imageHeight: true,
  imageId: true,
  imageSlug: true,
  imageWidth: true,
  listed: true,
  monthly_views: true,
  numDownvotes: true,
  numUpvotes: true,
  numTotalVotes: true,
  staffPick: true,
  subline: true,
  viewerIsAuthor: true,
  weekly_views: true,
  yearly_views: true,
};

const publicArticleFields = _.keys(publicArticleFieldsProjection);

const send404 = function(res) {
  res.status(404).send('Error 404. Page not found.');
}

const wtimeout = 15 * 1000;

module.exports = {
  getNextId: getNextId,
  joinArticleWithImage: joinArticleWithImage,
  joinArticleArrayWithImages: joinArticleArrayWithImages,
  logError: logError,
  publicArticleFields: publicArticleFields,
  publicArticleFieldsProjection: publicArticleFieldsProjection,
  send404: send404,
  wtimeout: wtimeout
};
