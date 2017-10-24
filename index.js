const sqlite = require('sqlite'),
      Sequelize = require('sequelize'),
      request = require('request'),
      express = require('express'),
      app = express();

const { PORT=3000, NODE_ENV='development', DB_PATH='./db/database.db' } = process.env;



const models = require('./models');

// START SERVER
Promise.resolve()
  .then(() => app.listen(PORT, () => console.log(`App listening on port ${PORT}`)))
  .catch((err) => { if (NODE_ENV === 'development') console.error(err.stack); });

// ROUTES
app.get('/films/:id/recommendations', getFilmRecommendations);

// ROUTE HANDLER
function getFilmRecommendations(req, res) {
  let queryKeys = Object.keys(req.query);
  // query keys might be 'limit' and 'offset'

  let filmId = req.params.id;
  // 1. find the film that was passed in
  models.films.findById(filmId)
    .then( (film) => {
      // 2. use the genre_id to find all films with that genre and within +/- 15 years
      let lowDate = new Date(film.release_date);
      let highDate = new Date(film.release_date);
      lowDate.setFullYear(lowDate.getFullYear() - 15);
      highDate.setFullYear(highDate.getFullYear() + 15);

      models.films.findAll({
        // include: [{
        //     model: models.genres,
        //     where: { id: Sequelize.col('models.films.genre_id')}
        // }],
        attributes: ['id', 'title', 'release_date', 'genre_id'],
        where: {
          genre_id: film['genre_id'],
          release_date: {
            $and: {
              $gt: lowDate  ,
              $lt: highDate
            }
          }
        },
      })
      .then( (results) => {
        // use the external API to check each film and accept only
        // those films who:
        // 1. minimum of 5 reviews
        // 2. average rating greater than 4.0
        //
        // we can submit ALL the film ids in one request and NOT ONE AT A TIME!
        // build the comma-separated list of films
        let filmIdList = '';
        for( let i=0; i<results.length; i++ ) {
          filmIdList += results[i].id + ',';
        }
        // trash the trailing comma...
        filmIdList = filmIdList.slice(0,-1);
        console.log(filmIdList);
        // console.log('in results');
        let options = {
          uri: `http://credentials-api.generalassemb.ly/4576f55f-c427-4cfc-a11c-5bfe914ca6c1?films=${filmIdList}`,
          json: true // Automatically parses the JSON string in the response
        };
        // console.log(options);
        // TODO: now that we have made the one request to get all the reviews,
        // go through the reviews and match them up with the films...
        request.get(options, (err, response, body)=>{
          // single response will contain all the reviews as a list
          let reviews = response.body;
          console.log(`${reviews.length} reviews have been received!`);
          // go ahead and merge the reviews into the films data
          for( let j=0; j<results.length; j++ ) {
            if( results[j].id === reviews[j].film_id ) {
              results[j].reviews = reviews[j].reviews;
            } else {
              console.log('Something in the ordering was wrong.');
            }
          }
          console.log('All reviews merged.');
          console.log(`Working with ${results.length} films.`);
          // filter accordingly
          results = results.filter( (result) => {
            if( result.reviews.length >= 5 ) {
              return true;
            }
            return false;
          })
          console.log(`Working with ${results.length} films.`);
          results = results.filter( (result) => {
            if( computeAverageRating(result.reviews) > 4.0 ) {
              return true;
            }
            return false;
          })
          console.log(`Working with ${results.length} films.`);
          let JSONresponse = []
          results.forEach( (result) => {
            JSONresponse.push({
              id: result.id,
              title: result.title,
              releaseDate: result.release_date,
              genre: result.genre_id,
              averageRating: Math.round( computeAverageRating(result.reviews) * 10 ) / 10,
              reviews: result.reviews.length
            })
          })
          res.json({recommendations: JSONresponse})
        });
    })
    .catch( (err) => { // didn't find the id
      res.status(422).json({message: '"message" key missing'});
    })
  })
  .catch( (err) => { // didn't find the id
    res.status(422).json({message: '"message" key missing'});
  })
}

function computeAverageRating( reviews ) {
  let total = 0.0;
  let numberOfReviews = reviews.length;
  reviews.forEach( (review) => {
    total += review.rating;
  });
  return total / numberOfReviews;
}


// catch 404 and forward to error handler
app.use(function(req, res, next) {
  console.log('caught missing route');
  res.status(404).json({message: '"message" key missing'});
});


module.exports = app;
