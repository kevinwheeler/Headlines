/*
 * We use an absolutely positioned navbar with a regularly positioned element of equal height underneath it. We wanted
 * the navbar to be absolutely positioned so that we could make it sticky. So then we stuck a regularly positioned element
 * of equal height underneat it so that the actual content of the page won't accidentally go underneath it.
 */
import $ from 'jquery';
import _ from 'lodash';
import Backbone from 'backbone';
//import Marionette from 'backbone.marionette';

import 'STYLESDIR/css/nav.css';
import 'STYLESDIR/stylus/nav.css';
import bootstrap from 'bootstrap';
import {categories} from 'ISOMORPHICDIR/categories';
import template from 'TEMPLATESDIR/navTemplate.hbs';

export default Backbone.View.extend({
  //These first few properties are standard Backbone properties. Look them up in Backbone's documentation.
  className: 'kmw-nav navbar',

  initialize: function(options = {}) {
    this.options = options;

    this.currentUser = options.currentUser;
    this.listenTo(this.currentUser, 'change', this.render);

    this.render();
    this.updateWhenBreakpointReached();
    this.toggleStickyOnScroll();
  },

  tagName: 'nav',

  template: template,

  render: _.throttle(function() {
      this.$el.children().detach();
      this.$el.html(this.template({
        categories: categories,
        displayAdmin: this.currentUser.get('userType') === 'admin'
        //doneFetching: this.currentUser.get('doneFetching'),
        //loggedIn: this.currentUser.get('loggedIn'),
        //userId: this.currentUser.get('fbId')
      }));
      this.setActiveElement();
      return this;
    }, 16
  ),

  // All of the following properties are not standard backbone properties.
  disableSticky: function() {
    this.$('.kmw-navbar-header').removeClass('kmw-navbar-header-sticky');
    this.$('.kmw-navbar').removeClass('kmw-navbar-sticky');
    //this.$('.kmw-navbar-brand').removeClass('kmw-sticky');
  },

  enableSticky: function() {
    this.$('.kmw-navbar-header').addClass('kmw-navbar-header-sticky');
    this.$('.kmw-navbar').addClass('kmw-navbar-sticky');
    //this.$('.kmw-navbar-brand').addClass('kmw-sticky');
  },

  isMobile: function() {
    // breakpoint duplicated in nav.styl
    return window.matchMedia("(max-width: 1199px)").matches
  },

  setActiveElement: function() {
    // url without the host info. EX: if we are at 'example.com/route'
    // routeUrl will hold '/route'
    let routeUrl = window.location.href.toString().split(window.location.host)[1];
    let $navAnchors = this.$('li a');
    $navAnchors.each(function() {
      if (this.getAttribute('href') === routeUrl) {
        this.parentNode.className += ' active';
      }
    });
  },

  updateWhenBreakpointReached: function() {
    let self = this;
    $(window).resize(_.debounce(function() {
        if (self.isMobile()) {
          self.$el.addClass('kmw-nav-mobile');
          self.disableSticky();
        } else {
          self.$el.removeClass('kmw-nav-mobile');
          if (self.shouldBeSticky()) {
            self.enableSticky();
          } else{
            self.disableSticky();
          }
        }
      }, 30)
    );
  },

  shouldBeSticky: function() {
    let currentScrollAmount = $("#js-app").scrollTop();
    let NUM_PIXELS_THRESHOLD = 0;
    return (currentScrollAmount > NUM_PIXELS_THRESHOLD) && !this.isMobile();
  },

  toggleStickyOnScroll: function() {
    let self = this;

    let runOnScroll = function() {
      if (self.shouldBeSticky()) {
        self.enableSticky();
      } else {
        self.disableSticky();
      }
    };

    runOnScroll = _.throttle(runOnScroll, 100);

    $("#js-app")[0].addEventListener("scroll", runOnScroll);
  }
});
