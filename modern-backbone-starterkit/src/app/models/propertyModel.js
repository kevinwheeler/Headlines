// consider this an abstract class. AKA don't initialize instances of this class.
// initialize instances of the subclasses instead.
import Backbone from 'backbone';

export default Backbone.Model.extend({
  getURL() {
    return this.URL;
  }
});
