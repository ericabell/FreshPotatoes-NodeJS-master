'use strict';
module.exports = function(sequelize, DataTypes) {
  var genres = sequelize.define('genres', {
    name: {
      type: DataTypes.STRING,
      allowNull: false
    },
  }, {timestamps: false}, {underscored: true})

  return genres;
};
