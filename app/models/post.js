const bookshelf = require("../db/bookshelf");

require("./comment");
require("./user");

const Post = bookshelf.Model.extend({
  tableName: "posts",
  hasTimestamps: true,
  author: function() {
    return this.belongsTo("User", "author");
  },
  comments: function() {
    return this.hasMany("Comment");
  }
});

module.exports = bookshelf.model("Post", Post);
