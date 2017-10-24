const sqlite = require('sqlite'),
      Sequelize = require('sequelize'),
      request = require('request'),
      express = require('express'),
      app = express();

const { PORT=3000, NODE_ENV='development', DB_PATH='./db/database.db' } = process.env;



const models = require('./models');

// create the relationship between films and genres
// every film will belongTo a genre
models.films.belongsTo(models.genres, {
  foreignKey: 'genre_id'
});

// START SERVER
Promise.resolve()
  .then(() => app.listen(PORT, () => console.log(`App listening on port ${PORT}`)))
  .catch((err) => { if (NODE_ENV === 'development') console.error(err.stack); });

// ROUTES
app.get('/films/:id/recommendations', getFilmRecommendations);

// ROUTE HANDLER
function getFilmRecommendations(req, res) {
  // query keys might be 'limit' and 'offset'
  let limit = 10;
  if( req.query.limit ) {
    limit = parseInt(req.query.limit);
  }
  let offset = 0;
  if( req.query.offset ) {
    offset = parseInt(req.query.offset);
  }

  let filmId = req.params.id;
  // 1. find the film that was passed in
  models.films.findById(filmId)
    .then( (film) => {
      if( film ) {
        // 2. use the genre_id to find all films with that genre and within +/- 15 years
        let lowDate = new Date(film.release_date);
        let highDate = new Date(film.release_date);
        lowDate.setFullYear(lowDate.getFullYear() - 15);
        highDate.setFullYear(highDate.getFullYear() + 15);

        models.films.findAll({
          where: {
            genre_id: film['genre_id'],
            release_date: {
              $and: {
                $gt: lowDate  ,
                $lt: highDate
              }
            }
          },
          include: [models.genres]
        })
        .then( (results) => {
          // use the external API to check each film and accept only
          // those films who:
          // 1. minimum of 5 reviews
          // 2. average rating greater than 4.0
          //
          // build the comma-separated list of films
          let filmIdList = '';
          for( let i=0; i<results.length; i++ ) {
            filmIdList += results[i].id + ',';
          }
          // trash the trailing comma...
          filmIdList = filmIdList.slice(0,-1);

          // build the url request to 3rd party API
          let options = {
            uri: `http://credentials-api.generalassemb.ly/4576f55f-c427-4cfc-a11c-5bfe914ca6c1?films=${filmIdList}`,
            json: true // Automatically parses the JSON string in the response
          };

          // SEND REQUEST TO 3RD PARTY API TO GET REVIEWS
          request.get(options, (err, response, body)=>{
            // single response will contain all the reviews as a list
            let reviews = response.body;

            // go ahead and merge the reviews into the films data
            for( let j=0; j<results.length; j++ ) {
              if( results[j].id === reviews[j].film_id ) {
                results[j].reviews = reviews[j].reviews;
              } else {
                console.log('Something in the ordering was wrong.');
              }
            }

            // remove films that don't have at least 5 reviews
            results = results.filter( (result) => {
              if( result.reviews.length >= 5 ) {
                return true;
              }
              return false;
            })

            // remove films that don't have an average rating of at least 4.0
            results = results.filter( (result) => {
              if( computeAverageRating(result.reviews) > 4.0 ) {
                return true;
              }
              return false;
            })

            // build the list of films we are going to send back using the
            // supllied API endpoint specification
            let JSONresponse = []
            results.forEach( (result) => {
              JSONresponse.push({
                id: result.id,
                title: result.title,
                releaseDate: result.release_date,
                genre: result.genre.name,
                averageRating: Math.round( computeAverageRating(result.reviews) * 100 ) / 100,
                reviews: result.reviews.length
              })
            })

            // deal with limit and offset, if they were supplied
            // we need to limit the results and also offset (if it was supplied)
            // offset can't be greater than total number of results
            res.json({
              recommendations: JSONresponse.slice(offset, offset+limit),
              meta: {limit: limit, offset: offset}
            })
          });
    })
    .catch( (err) => { // didn't find the id
      console.log(err);
      res.status(422).json({message: '"message" key missing'});
    })
  } // end if
  else {
    res.status(422).json({message: '"message" key missing'});
  }
  })
  .catch( (err) => { // didn't find the id
    console.log(err);
    res.status(422).json({message: '"message" key missing'});
  })
} // end function

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
