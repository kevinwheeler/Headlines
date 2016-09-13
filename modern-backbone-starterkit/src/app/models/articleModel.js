// consider this an abstract class. AKA don't initialize instances of this class.
// initialize instances of the subclasses instead.
import Backbone from 'backbone';
import serviceProvider from 'UTILSDIR/serviceProvider';

export default Backbone.Model.extend({
  defaults: {
    _id: null,
    articleURL: null, // This attribute is only found client side, and is created during parse()
    articleURLSlug: null,
    dateCreated: null,
    headline: null,
    imageURL: null,
    subline: null
  },

  idAttribute: "_id",

  initialize: function(options) {
    window.kmwmod = this;
    if (options.setIdToCurrentArticle === true) {
      this._id = serviceProvider.getRouter().getArticleIdOfCurrentRoute();
    }
  },

  url: function() {
    return "/api/article";
  },

  parse: function(articleJSON, options) {
    articleJSON.articleURL = '/' + serviceProvider.getRouter().exports.articleRoutePrefix + '/' + articleJSON.articleURLSlug;
    articleJSON.doneFetching = true;
    return articleJSON;
  },

  fetchArticle: function() {
      this.fetch({
        data: $.param({
          articleId: this._id,
          incrementViews: true
        }),
      });
  },
});
