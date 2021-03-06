import $ from 'jquery';
import _ from 'lodash';
import Backbone from 'backbone';
//import Marionette from 'backbone.marionette';

import template from 'TEMPLATESDIR/userTemplate.hbs';

//export default Marionette.ItemView.extend({
export default Backbone.View.extend({
  // The first few attributes are all standard backbone attributes that can be
  // found in the backbone documentation.
  className: 'kmw-user-view',

  events: {
  },

  initialize: function(options = {}) {
    this.userModel = options.userModel;

    this.articleGridView = options.articleGridView;
    this.listenTo(this.userModel, 'change', this.render);
    this.render();
  },

  render: _.throttle(function () {
      this.$el.html(template({
        displayName: this.userModel.get('displayName'),
      }));
      this.attachSubViews();
      return this;
    }, 16
  ),

  // Attributes below aren't standard backbone attributes. They are custom.
  attachSubViews: function() {
    const $articleGrid = this.$('.ARTICLE-GRID-STUB');
    $articleGrid.replaceWith(this.articleGridView.$el);
  },
});
