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
        // console.log('in results');
        Promise.all(results.map(film => new Promise((resolve, reject)=>{
          let options = {
            uri: `http://credentials-api.generalassemb.ly/4576f55f-c427-4cfc-a11c-5bfe914ca6c1?films=${film.id}`,
            json: true // Automatically parses the JSON string in the response
          };
          // console.log(options);
          request.get(options, (err, response, body)=>{
            // console.log(`GET request came back for film_id: ${film.id}`);
            // append the results from review API to the film
            film.reviews = response.body[0].reviews;
            if(err){
              return reject(err);
            }
            return resolve(film);
          });
        })))
        .then( (filmsWithReviewInfo) => {
          // console.log('all promises resolved!');
          // console.log(filmsWithReviewInfo[0].reviews);

          // filter movies with at least 5 reviews
          let filmsFiltered = filmsWithReviewInfo.filter( (film) => {
            // console.log(`Checking film_id: ${film.id}`);
            if( film.reviews.length >= 5 ) {
              // console.log(`Has 5 or more reviews`);
              let total = 0;
              film.reviews.forEach( (review) => {
                total += review.rating;
              })
              let averageRating = total / film.reviews.length;
              // console.log(`Average Rating: ${averageRating}`);
              if( averageRating >= 4.0 ) {
                // console.log(`adding film`);
                film.averageRating = averageRating;
                return true;
              } else {
                return false;
              }
            } else {
              // console.log(`doesn't have 5 or more reviews`);
              return false;
            }
          })


          let recommendations = [];
          filmsFiltered.forEach( (film) => {
            // print the id and number of reviews
            // console.log(`id: ${film.id} with ${film.reviews.length} reviews`);
            recommendations.push({id: film.id,
                                  title: film.title,
                                  releaseDate: film['release_date'],
                                  genre: film['genre_id'],
                                  averageRating: film.averageRating,
                                  reviews: film.reviews.length});
          })

          res.json({'recommendations': recommendations,
                    'meta': { limit: 10, offset: 0 }
                  });
        })
        .catch( (error) => {
          res.send(error);
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

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  console.log('caught missing route');
  res.status(404).json({message: '"message" key missing'});
});


module.exports = app;
