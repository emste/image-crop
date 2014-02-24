(function(global) {
	'use strict';

	/**
	 * Creates a new ImageCrop object. Sets a target dom element and a custom
	 * configuration. See the 'defaults' object for possible properties.
	 *
	 * @param target dom element
	 * @param config optional configuration object
	 */
	var ImageCrop = function(target, config) {
		this.target = target;

		this.fileReader = new FileReader();
		this.fileReader.onload = this.callbacks.onFileReaderLoad.bind(this);

		this.options = config || {};
	};

	ImageCrop.prototype = {
		target: null,
		fileReader: null,
		imageBase64: null,

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
		 * @param imageFile File object
		 */
		read: function(imageFile) {
			this.fileReader.readAsDataURL(imageFile);
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
				this.targetWidth / this.proportion, this.targetHeight / this.proportion,
				0, 0,
				this.getOutputWidth(), this.getOutputHeight()
			);

			return canvas.toDataURL();
		},

		/***********************************************************************
		 * private methods below
		 **********************************************************************/

		/**
		 * Returns the given property from the options object or falls back to
		 * defaults if.
		 *
		 * @param name
		 */
		getOpt: function(name) {
			return (undefined !== this.options[name] ? this.options : this.defaults)[name];
		},

		getOutputWidth: function() {
			return this.getOpt('outputWidth') || this.targetWidth;
		},

		getOutputHeight: function() {
			return this.getOpt('outputHeight') || this.targetHeight;
		},

		/**
		 * Initializes or resets the canvas element.
		 */
		show: function() {
			var proportionX, proportionY, style;

			style = window.getComputedStyle(this.target);

			this.targetWidth  = parseInt(style.width, 10);
			this.targetHeight = parseInt(style.height, style);

			proportionX = this.targetWidth / this.image.width;
			proportionY = this.targetHeight / this.image.height;

			this.proportion = this.minProportion = Math.max(proportionX, proportionY);
			this.maxProportion = Math.min(
				this.targetWidth / this.getOutputWidth(),
				this.targetHeight /  this.getOutputHeight()
			);

			this.offsetX = this.offsetY = 0;

			if(null === this.canvas) {
				this.canvas = document.createElement('canvas');
				this.target.appendChild(this.canvas);
				this.canvas.addEventListener('touchstart', this.callbacks.onTouchStart.bind(this), false)
				this.canvas.addEventListener('touchend', this.callbacks.onTouchEnd.bind(this), false)
				this.canvas.addEventListener('touchmove', this.callbacks.onTouchMove.bind(this), false);
			}
			this.canvas.width = this.targetWidth;
			this.canvas.height = this.targetHeight;

			this.draw();
		},

		/**
		 * Either (re)draws the canvas instantly or queues for the next
		 * animation frame.
		 */
		draw: function(/* internal */doIt) {
			var reqAnimFrame = this.getOpt('useRequestAnimationFrame');

			if(!doIt && reqAnimFrame) {
				window.cancelAnimationFrame(this.animationFrame);
				this.animationFrame = window.requestAnimationFrame(this.draw.bind(this, true));
			} else if(doIt || !reqAnimFrame) {
				this.canvas.width = this.canvas.width;
				this.canvas.getContext('2d').drawImage(
					this.image,
					this.offsetX, this.offsetY,
					this.targetWidth / this.proportion, this.targetHeight / this.proportion,
					0, 0,
					this.targetWidth, this.targetHeight
				);
			}
		},

		/**
		 * Convertion from data url to image element.
		 */
		retrieveImageData: function() {
			this.image = new Image;
			this.image.onload = this.callbacks.onImageLoad.bind(this);
			this.image.src = this.imageBase64;
		},

		/**
		 * Updates the current offset by the given delta values if possible.
		 *
		 * @return boolean true if changed
		 */
		updateOffset: function(dX, dY) {
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
			this.proportion = Math.max(this.minProportion, Math.min(this.maxProportion, this.proportion - p));

			return old !== this.proportion;
		},

		/**
		 * Stores methods used as event callbacks. Conext is bound to the
		 * ImageCrop object.
		 */
		callbacks: {
			onFileReaderLoad: function(e) {
				this.imageBase64 = e.target.result;
				this.retrieveImageData();
			},

			onImageLoad: function(e) {
				this.show();
			},

			onTouchStart: function(e) {
				this.activeTouches = Math.max(1, this.activeTouches + 1);

				if(this.activeTouches == 1) {
					this.singleTouch = true;
				} else if(this.activeTouches == 2) {
					this.singleTouch = false;
					this.multiTouch = true;
				}
			},

			onTouchEnd: function(e) {
				this.activeTouches = Math.max(0, this.activeTouches - 1);

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
					zoomSpeed, zoomUpdateOffset, factor;

				if(Math.abs(distance - this.lastDistance) < this.getOpt('zoomDelay')) {
					return;
				}

				if(this.lastDistance) {
					zoomSpeed = this.getOpt('zoomSpeed');

					factor = this.lastDistance > distance ? 1 : -1;

					if(this.updateProportion(factor * zoomSpeed * this.proportion)) {
						zoomUpdateOffset = -factor * .5 / this.proportion;
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
