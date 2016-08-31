//TODO move any logic that deals with the summary collections out of this file.
const logError = require('../utils').logError;

function getRouteFunction(db) {

  const MAX_ARTICLES_PER_REQUEST = 50;
  const MAX_SKIP_AHEAD_AMOUNT = 1000;

  // Returns an error object or null. If error object isn't null, will have the property
  // clientError set to true so that we can send a 4xx response instead of a 5xx response.
  function validateMostViewedArticlesParams(dontInclude, howMany, timeInterval, skipAheadAmount) {
    let validationErrors = [];

    if (typeof(dontInclude) !== "object") {
      validationErrors.push("dontInclude invalid");
    }

    if (typeof(howMany) !== "number" || howMany < 1 || howMany > MAX_ARTICLES_PER_REQUEST) {
      validationErrors.push("howMany invalid");
    }

    if (timeInterval !== 'daily' && timeInterval !== 'weekly' && timeInterval !== 'monthly'
      && timeInterval !== 'yearly' && timeInterval !== 'all_time') {
      validationErrors.push("invalid time interval");
    }

    if (typeof(skipAheadAmount) !== "number" || Number.isNaN(skipAheadAmount) || skipAheadAmount < 0 || skipAheadAmount > MAX_SKIP_AHEAD_AMOUNT) {
      validationErrors.push("skipAheadAmount invalid");
    }

    if (validationErrors.length) {
      validationErrors = new Error(JSON.stringify(validationErrors));
      validationErrors.clientError = true;
    } else {
      validationErrors = null;
    }

    return validationErrors;
  }

  function getMostViewedArticlesJSON(dontInclude, howMany, timeInterval, skipAheadAmount) {
    let validationErrors = validateMostViewedArticlesParams(dontInclude, howMany, timeInterval, skipAheadAmount);

    let prom = new Promise(function(resolve, reject) {
      if (validationErrors !== null) {
        reject(validationErrors)
      } else {
        db.collection('summary_of_' + timeInterval, (err, summaryColl) => {
          if (err !== null) {
            reject(err);
          } else {
            summaryColl.find({
              _id: {
                $nin: dontInclude
              },
              approval: 'approved'
            }).sort([['views', -1]]).skip(skipAheadAmount).limit(howMany).project("_id").toArray(
              function (err, articleIDs) {
                if (err !== null) {
                  reject(err);
                } else {
                  db.collection('article', (err, articleColl) => {
                    if (err !== null) {
                      reject(err);
                    } else {
                      const IDs = articleIDs.map(function (item) {
                        return item._id;
                      });
                      articleColl.find({
                        _id: {$in: IDs}
                      }).toArray(
                        function (err, articles) {
                          if (err !== null) {
                            reject(err);
                          } else {
                            articles.sort(function (a, b) {
                              return IDs.indexOf(a._id) - IDs.indexOf(b._id);
                            });
                            resolve(articles);
                          }
                        }
                      );
                    }
                  });
                }
              }
            );
          }
        });
      }
    });
    return prom;
  }


  const routeFunction = function (req, res, next) {
    const dontInclude = req.body.dont_include;
    const howMany = req.body.how_many;
    const timeInterval = req.body.time_interval;
    const skipAheadAmount = parseInt(req.body.skip_ahead_amount, 10);
    getMostViewedArticlesJSON(dontInclude, howMany, timeInterval, skipAheadAmount).then(
      function(articlesJSON) {
        res.send(articlesJSON);
      },
      function(err) {
        if (err.clientError === true){
          res.status(400).send("Something went wrong.");;
        } else {
          logError(err);
          next(err);
        }
      }
    );
  };

  return routeFunction;
}

module.exports = getRouteFunction;