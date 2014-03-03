(function(global) {
	'use strict';

	/**
	 * Creates a new ImageCrop object. Sets a target dom element and a custom
	 * configuration. See the 'defaults' object for possible properties.
	 *
	 * @param target dom element
	 * @param config [optional] configuration object
	 */
	var ImageCrop = function(target, config) {
		this.target = target;
		this.options = config || {};
	};

	ImageCrop.EVENT_ERROR_FILE_TYPE  = 'error.filetype';
	ImageCrop.EVENT_ERROR_IMAGE_SIZE = 'error.size';
	ImageCrop.EVENT_IMAGE_LOADING    = 'image.loading;'
	ImageCrop.EVENT_IMAGE_LOADED     = 'image.loaded';

	ImageCrop.prototype = {
		target: null,
		fileReader: null,

		activeTouches: 0,
		singleTouch: false,
		multiTouch: false,

		proportion: null,
		minProportion: null,
		targetWidth: null,
		targetHeight: null,

		lastTouchX: null,
		lastTouchY: null,

		lastDistance: null,

		offsetX: null,
		offsetY: null,

		canvas: null,

		options: null,

		animationFrame: null,

		listeners: null,

		defaults: {
			'zoomSpeed': .035,
			'scrollSpeed': 1,
			'zoomDelay': 1,
			'useRequestAnimationFrame': true,
			'outputWidth': null,
			'outputHeight': null
		},

		/**
		 * Read and load the given source file, will override any previously
		 * loaded image data. Make sure the file is of type image/*.
		 *
		 * @param file File object
		 */
		read: function(file) {
			if(!/image\/*/.test(file.type)) {
				this.resetCanvas();
				return this.fireEvent(ImageCrop.EVENT_ERROR_FILE_TYPE);
			}

			this.fireEvent(ImageCrop.EVENT_IMAGE_LOADING);

			if(null === this.fileReader) {
				this.fileReader = new FileReader();
				this.fileReader.onload = this.callbacks.onFileReaderLoad
					.bind(this);
			}

			var that = this;
			EXIF.getData(file, function(){ that.exifData = this.exifdata; });

			this.fileReader.readAsDataURL(file);

			return this;
		},

		/**
		 * Returns the currently visible area as data url (base64).
		 */
		crop: function() {
			var canvas = document.createElement('canvas');
			canvas.width = this.getOutputWidth();
			canvas.height = this.getOutputHeight();

			canvas.getContext('2d').drawImage(
				this.image,
				this.offsetX, this.offsetY,
				this.targetWidth / this.proportion,
				this.targetHeight / this.proportion,
				0, 0,
				this.getOutputWidth(), this.getOutputHeight()
			);

			return canvas.toDataURL();
		},


		/**
		 * Adds a listener which will be called with the given context. Listens
		 * to all events if no event name is specified.
		 *
		 * @param fn function
		 * @param ctx [opional] context
		 * @param ev [optional] name of the event to listen to
		 */
		addListener: function(fn, ctx, ev) {
			if(!this.listeners) this.listeners = [];

			this.listeners.push({fn: fn, ctx: ctx, ev: ev});

			return this;
		},

		/**
		 * Removes a previously added listener.
		 *
		 * @param fn function
		 * @param ctx [optional] context
		 */
		removeListener: function(fn, ctx) {
			var l = (this.listeners || []).length,
				listener;

			while(l--) {
				listener = this.listeners[l];

				if(listener.fn === fn && listener.ctx === ctx) {
					this.listeners.splice(l, 1);
				}
			}

			return this;
		},

		/***********************************************************************
		 * private methods below
		 **********************************************************************/

		/**
		 * Returns the given property from the options object or falls back to
		 * defaults.
		 */
		getOpt: function(name) {
			return (undefined !== this.options[name] ? this.options :
				this.defaults)[name];
		},

		getOutputWidth: function() {
			return this.getOpt('outputWidth') || this.targetWidth;
		},

		getOutputHeight: function() {
			return this.getOpt('outputHeight') || this.targetHeight;
		},

		fireEvent: function(type) {
			var l = (this.listeners || []).length,
				listener;

			while(l--) {
				listener = this.listeners[l];
				if(listener.ev && listener.ev !== type) continue;
				listener.fn.call(listener.ctx || null, type);
			}
		},

		/**
		 * Initializes or updates the canvas element.
		 */
		show: function() {
			var proportionX, proportionY, style;

			style = window.getComputedStyle(this.target);

			this.targetWidth  = parseInt(style.width, 10);
			this.targetHeight = parseInt(style.height, style);

			proportionX = this.targetWidth / this.image.width;
			proportionY = this.targetHeight / this.image.height;

			// iOS bug?! maybe related to subsampling issue (http://stackoverflow.com/questions/11929099/html5-canvas-drawimage-ratio-bug-ios)... either way, restricting proportion to 0.13 works around the issue
			this.proportion = Math.max(proportionX, proportionY, 0.13);
			this.minProportion = this.proportion;
			this.maxProportion = Math.min(
				this.targetWidth / this.getOutputWidth(),
				this.targetHeight / this.getOutputHeight()
			);

			if(this.proportion > this.maxProportion) {
				this.resetCanvas();
				return this.fireEvent(ImageCrop.EVENT_ERROR_IMAGE_SIZE);
			}

			this.offsetX = this.offsetY = 0;

			this.createCanvas();
			this.canvas.width = this.targetWidth;
			this.canvas.height = this.targetHeight;

			this.draw();

			this.fireEvent(ImageCrop.EVENT_IMAGE_LOADED);
		},

		/**
		 * Either (re)draws the canvas instantly or queues for the next
		 * animation frame.
		 */
		draw: function(/* internal */doIt) {
			var reqAnimFrame = this.getOpt('useRequestAnimationFrame'), co;

			if(!doIt && reqAnimFrame) {
				window.cancelAnimationFrame(this.animationFrame);
				this.animationFrame = window.requestAnimationFrame(
					this.draw.bind(this, true)
				);
			} else if(doIt || !reqAnimFrame) {
				this.canvas.width = this.canvas.width;
				co = this.canvas.getContext("2d");

				co.save();
				this.transformCoordinate();
				co.drawImage(
					this.image,
					this.offsetX, this.offsetY,
					this.targetWidth / this.proportion,
					this.targetHeight / this.proportion,
					0, 0,
					this.targetWidth, this.targetHeight
				);
				co.restore();
			}
		},

		resetCanvas: function() {
			if(null !== this.canvas) {
				this.canvas.parentNode.removeChild(this.canvas);
				this.canvas = null;
			}
		},

		createCanvas: function() {
			if(null !== this.canvas) return;

			this.canvas = document.createElement('canvas');
			this.target.appendChild(this.canvas);

			this.canvas.addEventListener(
				'touchstart', this.callbacks.onTouchStart.bind(this), false
			);

			this.canvas.addEventListener(
				'touchend', this.callbacks.onTouchEnd.bind(this), false
			);

			this.canvas.addEventListener(
				'touchmove', this.callbacks.onTouchMove.bind(this), false
			);
		},

		/**
		 * Convertion from data url to image element.
		 */
		retrieveImageData: function(imageBase64) {
			this.image = new Image;
			this.image.onload = this.callbacks.onImageLoad.bind(this);
			this.image.src = imageBase64;
		},

		/**
		 * Updates the current offset by the given delta values if possible.
		 *
		 * @return boolean true if changed
		 */
		updateOffset: function(dX, dY) {
			var orientation = this.exifData.Orientation, tmp;
			if(orientation > 5) dX *= -1;
			if(orientation % 2 === 0) {
				tmp = dX;
				dX = dY; dY = tmp;
			}

			var maxX = (-this.targetWidth / this.proportion + this.image.width),
				maxY = (-this.targetHeight / this.proportion + this.image.height),

				newX = Math.min(maxX, Math.max(0, this.offsetX + dX / this.proportion)),
				newY = Math.min(maxY, Math.max(0, this.offsetY + dY / this.proportion)),

				changed = newX != this.offsetX || newY != this.offsetY;

			this.offsetX = newX;
			this.offsetY = newY;

			return changed;
		},

		/**
		 * Updates the current proportion by the given delta if possible.
		 *
		 * @return boolean true if changed
		 */
		updateProportion: function(p) {
			var old = this.proportion;
			this.proportion = Math.max(
				this.minProportion,
				Math.min(this.maxProportion, this.proportion - p)
			);

			return old !== this.proportion;
		},

		transformCoordinate: function() {
			var ctx = this.canvas.getContext('2d'),
				width = this.canvas.width,
				height = this.canvas.height,
				orientation = this.exifData.Orientation;

			switch(orientation) {
				case 5:
				case 6:
				case 7:
				case 8:
					this.canvas.width = height;
					this.canvas.height = width;
					break;
				default:
					this.canvas.width = width;
					this.canvas.height = height;
			}

			switch(orientation) {
				case 2:
					// horizontal flip
					ctx.translate(width, 0);
					ctx.scale(-1, 1);
					break;
				case 3:
					// 180 rotate left
					ctx.translate(width, height);
					ctx.rotate(Math.PI);
					break;
				case 4:
					// vertical flip
					ctx.translate(0, height);
					ctx.scale(1, -1);
					break;
				case 5:
					// vertical flip + 90 rotate right
					ctx.rotate(0.5 * Math.PI);
					ctx.scale(1, -1);
					break;
				case 6:
					// 90 rotate right
					ctx.rotate(0.5 * Math.PI);
					ctx.translate(0, -height);
					break;
				case 7:
					// horizontal flip + 90 rotate right
					ctx.rotate(0.5 * Math.PI);
					ctx.translate(width, -height);
					ctx.scale(-1, 1);
					break;
				case 8:
					// 90 rotate left
					ctx.rotate(-0.5 * Math.PI);
					ctx.translate(-width, 0);
					break;
				default:
					break;
			}
		},
		

		/**
		 * Stores methods used as event callbacks. Conext is bound to the
		 * ImageCrop object.
		 */
		callbacks: {
			onFileReaderLoad: function(e) {
				this.retrieveImageData(e.target.result);
			},

			onImageLoad: function(e) {
				this.show();
			},

			onTouchStart: function(e) {
				this.activeTouches = Math.max(1, this.activeTouches + e.changedTouches.length);

				if(this.activeTouches == 1) {
					this.singleTouch = true;
				} else if(this.activeTouches == 2) {
					this.singleTouch = false;
					this.multiTouch = true;
				}
			},

			onTouchEnd: function(e) {
				this.activeTouches = Math.max(0, this.activeTouches - e.changedTouches.length);

				if(this.activeTouches == 0) {
					this.multiTouch = this.singleTouch = false;
				}

				this.lastTouchX = this.lastTouchY = this.lastDistance = null;
			},

			onSingleTouch: function(t) {
				var scrollSpeed = this.getOpt('scrollSpeed');

				if(this.lastTouchX === null) this.lastTouchX = t.clientX;
				if(this.lastTouchY === null) this.lastTouchY = t.clientY;

				if(this.updateOffset(
					(this.lastTouchX - t.clientX) * scrollSpeed,
					(this.lastTouchY - t.clientY) * scrollSpeed
				)) {
					this.draw();
				}

				this.lastTouchX = t.clientX;
				this.lastTouchY = t.clientY;
			},

			onMultiTouch: function(t0, t1) {
				var dX = t1.clientX - t0.clientX,
					dY = t1.clientY - t0.clientY,
					distance = Math.sqrt(dX*dX + dY*dY),
					zoomSpeed, zoomUpdateOffset, factor,
					prevValue, newValue;

				if(Math.abs(distance - this.lastDistance) < this.getOpt('zoomDelay')) {
					return;
				}

				if(this.lastDistance) {
					zoomSpeed = this.getOpt('zoomSpeed');
					factor = this.lastDistance > distance ? 1 : -1;
					prevValue = this.offsetX + this.targetWidth / this.proportion;

					if(this.updateProportion(factor * zoomSpeed * this.proportion)) {
						newValue = this.offsetX + this.targetWidth / this.proportion;
						zoomUpdateOffset = (prevValue - newValue) * this.proportion / 2;
						this.updateOffset(zoomUpdateOffset, zoomUpdateOffset);
						this.draw();
					}
				}

				this.lastDistance = distance;
			},

			onTouchMove: function(e) {
				e.preventDefault();

				if(!this.multiTouch && e.touches.length == 1) {
					this.callbacks.onSingleTouch.call(this, e.touches[0]);
				} else if(e.touches.length == 2) {
					this.callbacks.onMultiTouch.call(this, e.touches[0], e.touches[1]);
				}

			}
		}
	};

	global.ImageCrop = ImageCrop;
})(window);
