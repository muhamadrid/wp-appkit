/**
 * Defines functions that can be called from theme functions.js. 
 * (Those functions can't be directly called form theme templates).
 */
define(function (require,exports) {

      "use strict";

      var _                   = require('underscore'),
          Backbone            = require('backbone'),
          RegionManager       = require('core/region-manager'),
          Utils               = require('core/app-utils'),
          Config              = require('root/config'),
          App                 = require('core/app'),
          Hooks               = require('core/lib/hooks'),
          TemplateTags        = require('core/theme-tpl-tags');
          
      var themeApp = {};
      
      
      /************************************************
	   * Events management
	   */
      
      //Event aggregator
	  var vent = _.extend({}, Backbone.Events);
	  themeApp.on = function(event,callback){
		  if( _.contains(['screen:leave',
		                  'screen:showed',
		                  'screen:before-transition',
		                  'menu:refresh',
		                  'header:render',
		                  'waiting:start',
		                  'waiting:stop'
		                  ], 
		                  event) ){
			  //Proxy RegionManager events :
			  RegionManager.on(event,callback);
		  }else{
			  vent.on(event,callback);
		  }
	  };
	  
	  //Proxy App events
	  App.on('all',function(event,data){
		  
		  var theme_event_data = format_theme_event_data(event,data);
		  
		  if( theme_event_data.type == 'error' 
			  || theme_event_data.type == 'info' 
			){
			  //2 ways of binding to error and info events :
			  vent.trigger(event,theme_event_data); //Ex: bind directly to 'info:no-content'
			  vent.trigger(theme_event_data.type,theme_event_data); //Ex: bind to general 'info', then filter with if( info.event == 'no-content' )
		  }
		  
	  });
	  
	  //Format events feedbacks
	  var format_theme_event_data = function(event,data){
		  
		  var theme_event_data = {event:event, type:'', message:'', data:data};
		  
		  if( event.indexOf('error:') === 0 ){
			  
			  theme_event_data.type = 'error';
			  theme_event_data.event = event.replace('error:','');
			  
			  //Error types (data.type) can be : 
			  // - 'ajax'
			  // - 'ws-data'
			  // - 'not-found'
			  // - 'wrong-data'
			  
			  if( data.type == 'ajax' ){
				  theme_event_data.message = 'Remote connexion to website failed'; 
			  }
			  else{
				  theme_event_data.message = 'Oops, an error occured...';
			  }
			  
		  }else if( event.indexOf('info:') === 0 ){
			  
			  theme_event_data.type = 'info';
			  theme_event_data.event = event.replace('info:','');
			  
			  if( event == 'info:no-content' ){
				  theme_event_data.message = "The application couldn't retrieve any content, please check your internet connexion!";
			  }
			  
		  }
		  
		  return theme_event_data;
	  };

	  
	  /************************************************
	   * Filters, actions and Params management
	   */
	  themeApp.filter = function (filter,callback){
		  Hooks.addFilter(filter,callback);
	  }
	  
	  themeApp.action = function (action,callback){
		  Hooks.addAction(action,callback);
	  }
	  
	  themeApp.setParam = function(param,value){
		  App.setParam(param,value);
	  };
	  
	  
	  /************************************************
	   * App contents refresh
	   */

	  var refreshing = 0;
	  
      themeApp.refresh = function(cb_ok,cb_error){
    	  
    	  refreshing++;
    	  vent.trigger('refresh:start');
    	  
    	  App.sync(function(){
    		  	RegionManager.buildMenu(
    		  		function(){
	    		  		App.resetDefaultRoute();
	        		  	App.router.default_route();
	        		  	Backbone.history.stop(); 
	        		  	Backbone.history.start();
	        		  	
	        		  	refreshing--;
	    				vent.trigger('refresh:end');
	    				
	    				if( cb_ok ){
	    					cb_ok();
	    				}
	    		  	},
	    		  	true
    		  	);
			},function(error){
				refreshing--;
				if( cb_error ){
					cb_error(format_theme_event_data('error',error));
				}
				vent.trigger('refresh:end');
			},
			true
		);
      };
      
      themeApp.isRefreshing = function(){
    	  return refreshing > 0;
      };
      
      /************************************************
	   * App navigation
	   */
      
      themeApp.navigate = function(navigate_to_fragment){
    	  App.router.navigate(navigate_to_fragment,{trigger: true});
      };
      
      
      /************************************************
	   * Back button
	   */
      
	  /**
	   * Automatically shows and hide Back button according to current screen (list, single, page, comments, etc...)
	   * Use only if back button is not refreshed at each screen load! (otherwhise $go_back_btn will not be set correctly).
	   * @param $go_back_btn Back button jQuery DOM element 
	   */
	  themeApp.setAutoBackButton = function($go_back_btn,do_before_auto_action){
		  RegionManager.on('screen:showed',function(current_screen,view){
			  var display = themeApp.getBackButtonDisplay();
			  if( display == 'show' ){
				  if( do_before_auto_action != undefined ){
					  do_before_auto_action(true);
				  }
				  $go_back_btn.show();
				  themeApp.updateBackButtonEvents($go_back_btn);
			  }else if( display == 'hide' ){
				  if( do_before_auto_action != undefined ){
					  do_before_auto_action(false);
				  }
				  themeApp.updateBackButtonEvents($go_back_btn);
				  $go_back_btn.hide();
			  }
		  });
	  };
	  
	  /**
	   * To know if the back button can be displayed on the current screen,
	   * according to app history. Use this to configure back button 
	   * manually if you don't use themeApp.setAutoBackButton().
	   */
	  themeApp.getBackButtonDisplay = function(){
		  var display = '';
		  
		  var previous_screen = App.getPreviousScreenData();
		  
		  if( !_.isEmpty(previous_screen) ){
			  display = 'show';
		  }else{
			  display = 'hide';
		  }
		  
		  return display;
	  };
	  
	  /**
	   * Sets back buton click event. Use this to configure back button 
	   * manually if you don't use themeApp.setAutoBackButton().
	   * @param $go_back_btn Back button jQuery DOM element 
	   */
	  themeApp.updateBackButtonEvents = function($go_back_btn){
		  if( $go_back_btn.length ){
			  var display = themeApp.getBackButtonDisplay();
			  if( display == 'show' ){
				  $go_back_btn.unbind('click').click(function(e){
					  e.preventDefault();
					  var prev_screen_link = App.getPreviousScreenLink();
					  themeApp.navigate(prev_screen_link);
				  });
			  }else if( display == 'hide' ){
				  $go_back_btn.unbind('click');
			  }
		  }
	  };
	  
	  /************************************************
	   * "Get more" link
	   */
	  
	  themeApp.getGetMoreLinkDisplay = function(){
		  var get_more_link_data = {display:false, nb_left:0};
		  
		  var current_screen = App.getCurrentScreenData();
		  if( current_screen.screen_type == 'list' ){
			  var component = App.components.get(current_screen.component_id);
	    	  if( component ){
	    		  var component_data = component.get('data');
	    		  if( component_data.hasOwnProperty('ids') ){
		    		  var nb_left = component_data.total - component_data.ids.length;
		    		  get_more_link_data.nb_left = nb_left;  
		    		  get_more_link_data.display = nb_left > 0;
	    		  }
	    	  }
		  }
		  
		  return get_more_link_data;
	  };
	  
	  themeApp.getMoreComponentItems = function(do_after){
    	  var current_screen = App.getCurrentScreenData();
    	  if( current_screen.screen_type == 'list' ){
    		  App.getMoreOfComponent(
    			  current_screen.component_id,
    			  function(new_items,is_last,data){
    				  var current_archive_view = RegionManager.getCurrentView();
    				  current_archive_view.addPosts(new_items);
      				  current_archive_view.render();
      				  do_after(is_last,new_items,data.nb_left);
    			  }
    		  );
    	  }
      };
	  
	  /************************************************
	   * DOM element auto class
	   */
	  
	  /**
	   * Sets class to the given DOM element according to the given current screen. 
	   * If element is not provided, defaults to <body>.
	   */
	  var setContextClass = function(current_screen,element_id){
		  if( !_.isEmpty(current_screen) ){
			  var $element = element_id == undefined ? $('body') : $('#'+element_id);
			  $element.removeClass(function(index, css){
				  return (css.match (/\app-\S+/g) || []).join(' ');
			  });
			  $element.addClass('app-'+ current_screen.screen_type);
			  $element.addClass('app-'+ current_screen.fragment);
		  }
	  };
	  
	  /**
	   * Adds class on given DOM element according to the current screen.
	   * If element is not provided, defaults to <body>.
	   * @param activate Set to true to activate
	   */
	  themeApp.setAutoContextClass = function(activate,element_id){
		  if( activate ){
			  RegionManager.on('screen:showed',function(current_screen){ setContextClass(current_screen,element_id); } );
			  setContextClass(App.getCurrentScreenData(),element_id);
		  }
		  //TODO : handle deactivation!
	  };
      
	  
	  /************************************************
	   * Screen transitions
	   */
	  
	  themeApp.getTransitionDirection = function(current_screen,previous_screen){
		  var transition = 'replace';
		  
		  if( current_screen.screen_type == 'list' || current_screen.screen_type == 'custom-component' ){
			  if( previous_screen.screen_type == 'single' ){
				  transition = 'right';
			  }else{
				  transition = 'replace';
			  }
		  }else if( current_screen.screen_type == 'single' ){
			  if( previous_screen.screen_type == 'list' || previous_screen.screen_type == 'custom-component' ){
				  transition = 'left';
			  }else if( previous_screen.screen_type == 'comments' ){
				  transition = 'right';
			  }else{
				  transition = 'replace';
			  }
		  }else if( current_screen.screen_type == 'comments' ){
			  transition = 'left';
		  }else{
			  transition = 'replace';
		  }
		  
		  return transition;
	  };
	  
	  themeApp.setAutoScreenTransitions = function(transition_replace,transition_left,transition_right){

		  themeApp.setParam('custom-screen-rendering', true);

		  themeApp.action('screen-transition',function($deferred,$wrapper,$current,$next,current_screen,previous_screen){

			  var direction = themeApp.getTransitionDirection(current_screen,previous_screen);

			  switch(direction){
				  case 'left':
					  transition_left($wrapper,$current,$next,$deferred);
					  break;
				  case 'right':
					  transition_right($wrapper,$current,$next,$deferred);
					  break;
				  case 'replace':
					  transition_replace($wrapper,$current,$next,$deferred);
					  break;
				  default:
					  transition_replace($wrapper,$current,$next,$deferred);
				  	  break;
			  };

		  });
		  
	  };
	  
	  /************************************************
	   * App infos management
	   */
	  
	  themeApp.showCustomPage = function(template,data){
		  if( template == undefined ){
			  template = 'custom';
		  }
		  App.showCustomPage(template,data);
	  };
	  
	  //Use exports so that theme-tpl-tags and theme-app (which depend on each other, creating
	  //a circular dependency for requirejs) can both be required at the same time 
	  //(in theme functions.js for example) : 
	  _.extend(exports,themeApp);
});