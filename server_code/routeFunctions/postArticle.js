const _ = require('lodash');
const getNextId = require('../utils').getNextId;
const getURLSlug = require('../slugutil').getURLSlug;
const logError = require('../utils').logError;
const requester = require('request');
const sendgrid  = require('sendgrid')(process.env.SENDGRID_USERNAME, process.env.SENDGRID_PASSWORD);
const updateSummaries = require('../updateSummaries');
const validations = require('../../modern-backbone-starterkit/src/isomorphic/articleValidations.js');
const articleRoute = require('../../modern-backbone-starterkit/src/isomorphic/routes.js').articleRoute;

function getRouteFunction(db) {

  const notifyAdminViaEmail = function(articleURLSlug) {
    if (process.env.NODE_ENV !== "development") {
      const emailAddresses = ["kevinwheeler2@yahoo.com", "kevinwheeler90@gmail.com"];
      for (let i = 0; i < emailAddresses.length; i++) {
        sendgrid.send({
            to: emailAddresses[i],
            from: 'noreply@' + process.env.DOMAIN_NAME,
            subject: process.env.DOMAIN_NAME + ' article in need of approval',
            html: `article needs approval. <a href="${process.env.DOMAIN}/headline/${articleURLSlug}">view here.</a>`
          }, function (err, json) {
            if (err) {
              logError(err);
            }
          }
        );
      }
    }
  }

  let imageColl;
  function getImageColl() {
    const prom = new Promise(function(resolve, reject) {
      db.collection('image', {}, (err, coll) => {
        if (err !== null) {
          reject(err);
        } else {
          imageColl = coll;
          resolve();
        }
      });
    })
    return prom;
  }

  let articleColl;
  function getArticleColl() {
    const prom = new Promise(function(resolve,reject) {
      db.collection('article', {}, (err, coll) => {
        if (err !== null) {
          reject(err);
        } else {
          articleColl = coll;
          resolve();
        }
      });
    })
    return prom;
  }

  // Validations that are server-side only aka not isomorphic.
  const additionalValidations = function(agreedToTerms, imageSelectionMethod, imageId, postAnonymously, authorUrl, user) {
    let validationErrors = [];
    if (agreedToTerms === undefined) {
      validationErrors.push("Must agree to terms.");
    }

    if (imageSelectionMethod !== 'uploadNew' && imageSelectionMethod !== 'previouslyUploaded') {
      validationErrors.push("imageSelectionMethod invalid.");
    }

    if (!postAnonymously) {
      if (user) {
        if (_.isArray(user.pages)) {
          let found = false;
          _.forEach(user.pages, function(page) {
            if (authorUrl === page.link) {
              found = true;
            }
          });
          if (!found) {
            validationErrors.push("Page url not found in the pages that the user owns.");
          }
        } else {
          validationErrors.push("Not posting anonymously, but the user's page list isn't setup yet.");
        }
      } else {
        validationErrors.push("Not posting anonymously, but the user isn't logged in.");
      }
    }

    if (typeof(imageId) !== "number") {
      validationErrors.push("Image id is not a number");
      return Promise.resolve(validationErrors);
    } else {
      return getImageColl().then(function() {
        return imageColl.find({
          _id: imageId
        }).limit(1).next().then(function(image) {
          if (image === null) {
            validationErrors.push("Image not found in image collection.");
          }
        });
      }).then(function() {
        return Promise.resolve(validationErrors);
      });
    }
  };


  const routeFunction = function (req, res, next) {

    const RECAPTCHA_SECRET = process.env.RECAPTCHA_SECRET;

    const sess = req.session;
    const headline = req.body.headline;
    const subline = req.body.subline;
    const postAnonymously = req.body.post_anonymously;
    const authorUrl = req.body.author_url;
    const agreedToTerms = req.body.agreed_to_terms;
    const imageSelectionMethod = req.body.image_selection_method;
    const userAllowsImageReuse = req.body.user_allows_image_reuse;
    let imageId;
    if (imageSelectionMethod === 'uploadNew') {
      imageId = sess.imageId;
    } else {
      imageId = parseInt(req.body.image_id, 10);
    }

    //set model fields include re-usable image checkbox
    //
    //if selectionmethod = uploadnew, make sure re-usable is true or false

    const validationErrors = validations.validateEverything(headline, subline);
    getImageColl(
    ).then(function() {return additionalValidations(agreedToTerms, imageSelectionMethod, imageId, postAnonymously, authorUrl, req.user)}
    ).then(function(additionalValidationErrors) {
      if (validationErrors) {
        additionalValidationErrors.concat(validationErrors);
      }

      if (additionalValidationErrors.length) {
        res.status(400).send("Invalid parameters.");
      } else {
        const insertArticleAndRedirect = function() {
          getArticleColl(
          ).then(getNextId.bind(null, db, "articleId")
          ).then(function(articleId) {
            const articleURLSlug = getURLSlug(articleId, headline);
            const doc = {
              _id: articleId,
              articleURLSlug: articleURLSlug,
              category: 'other',
              dateCreated: new Date(),
              flaginess: 0,
              headline: headline,
              imageId: imageId,
              numAuthenticatedFlags: 0,
              numUnauthenticatedFlags: 0,
              numDownvotes: 0,
              numUpvotes: 0,
              numTotalVotes: 0,
              sidOfAuthor: req.sessionID,
              staffPick: false,
              subline: subline,
              upvoteScore: 0
            };

            if (!postAnonymously) {
              let authorName;
              _.forEach(req.user.pages, function(page) {
                if (authorUrl === page.link) {
                  authorName = page.name;
                }
              });
              //doc.authorUrl = req.user.fbId;
              doc.authorUrl = authorUrl;
              doc.authorName = authorName;
              if (authorName === undefined) {
                throw "authorName undefined";
              }
            }
            const AUTO_APPROVE_ARTICLES = true;
            //const AUTO_APPROVE_ARTICLES = false;
            if (AUTO_APPROVE_ARTICLES) {
              doc.approval = "autoApproved";
              doc.listed = false;
            } else {
              doc.approval = "pending";
              doc.listed = true;
            }
            const initialSummaryAttributes = updateSummaries.getInitialSummaryAttributes();
            _.merge(doc, initialSummaryAttributes);

            // TODO make note about how author id is considered a public field.
            //if (req.user) { // TODO make sure not posting anonymously
            //  doc.authorId = req.user.fbId;
            //}
            articleColl.insert(doc, {
                w: "majority",
              },
              (err, result) => {
                if (err !== null) {
                  logError(err);
                  next(err);
                } else {
                  notifyAdminViaEmail(articleURLSlug);
                  res.redirect('/' + articleRoute.routePrefix + '/' + articleURLSlug);
                }
              });

            if (userAllowsImageReuse) {
              imageColl.updateOne(
                {
                _id: imageId
                },
                {
                  $set: {userAllowsReusable: true}
                }
              ).catch(function(err) {
                logError(err);
              });
            }
          }).catch(function(err) {
            logError(err);
            next(err);
          });
        }

        if (req.body['kmw-bypass-recaptcha-secret'] === process.env.BYPASS_RECAPTCHA_SECRET) {
          insertArticleAndRedirect();
        } else {
          const recaptchaVerifyJSON = {secret: RECAPTCHA_SECRET, response: req.body['g-recaptcha-response']};

          //id = the id to use for the new record we are inserting.
          requester.post({url:'https://www.google.com/recaptcha/api/siteverify', form: recaptchaVerifyJSON},
            function(err, httpResponse, body) {
              if (err) {
                logError(err);
                res.status(500).send('Something went wrong! Please try again.');
              }
              else {
                var bodyJSON = JSON.parse(body);
                if (bodyJSON.success) {
                  // Captcha successful.
                  insertArticleAndRedirect();
                }
                else {
                  // Captcha failed.
                  res.redirect('/upload?captcha=fail'); //TODO
                }
              }
            });
        }
      }
    }).catch(function(err) {
      logError(err);
      next(err);
    });
  };

  return routeFunction;
}

module.exports = getRouteFunction;
