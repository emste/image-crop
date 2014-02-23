(function(global) {
	'use strict';

	var ImageCrop = function(target, options) {
		this.target = target;

		this.fileReader = new FileReader();
		this.fileReader.onload = this.callbacks.onFileReaderLoad.bind(this);

		this.options = options || {};
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

		backgroundPositionX: 0,
		backgroundPositionY: 0,

		canvas: null,

		options: null,

		defaults: {
			'zoomSpeed': .035,
			'scrollSpeed': 1,
			'zoomDelay': 1
		},

		read: function(file) {
			if(!file.type.match('image.*')) {
				// TODO
				throw new Error('No image given');
			}

			this.fileReader.readAsDataURL(file);
		},

		crop: function() {
		},

		getOpt: function(name) {
			return (undefined !== this.options[name] ? this.options : this.defaults)[name];
		},

		show: function() {
			var proportionX, proportionY, style;

			if(!this.imageBase64 || !this.image || !this.image.width) {
				throw new Error('Image data not initialized!');
			}

			style = window.getComputedStyle(this.target);

			this.targetWidth  = parseInt(style.width, 10);
			this.targetHeight = parseInt(style.height, style);

			if(this.image.width < this.targetWidth || this.image.height < this.targetHeight) {
				throw new Error('Image too small');
			}

			proportionX = this.targetWidth / this.image.width;
			proportionY = this.targetHeight / this.image.height;

			this.proportion = this.minProportion = Math.max(proportionX, proportionY);

			this.canvas = document.createElement('canvas');
			this.canvas.width = this.targetWidth;
			this.canvas.height = this.targetHeight;

			this.draw();

			this.target.appendChild(this.canvas);

			this.canvas.addEventListener('touchstart', this.callbacks.onTouchStart.bind(this), false)
			this.canvas.addEventListener('touchend', this.callbacks.onTouchEnd.bind(this), false)
			this.canvas.addEventListener('touchmove', this.callbacks.onTouchMove.bind(this), false);
		},

		draw: function() {
			this.canvas.width = this.canvas.width;
			this.canvas.getContext('2d').drawImage(
				this.image,
				this.backgroundPositionX, this.backgroundPositionY,
				this.targetWidth / this.proportion, this.targetHeight / this.proportion,
				0, 0,
				this.targetWidth, this.targetHeight
			);
		},

		retrieveImageData: function() {
			this.image = new Image;
			this.image.onload = this.callbacks.onImageLoad.bind(this);
			this.image.src = this.imageBase64;
		},

		updateBackgroundPosition: function(dX, dY) {
			var maxX = (-this.targetWidth + this.image.width * this.proportion) / this.proportion,
				maxY = (-this.targetHeight + this.image.height * this.proportion) / this.proportion,

				newX = Math.min(maxX, Math.max(0, this.backgroundPositionX + dX / this.proportion)),
				newY = Math.min(maxY, Math.max(0, this.backgroundPositionY + dY / this.proportion)),

				changed = newX != this.backgroundPositionX || newY != this.backgroundPositionY;

			this.backgroundPositionX = newX;
			this.backgroundPositionY = newY;

			return changed;
		},

		updateProportion: function(p) {
		 	 this.proportion = Math.max(this.minProportion, this.proportion - p);
		},

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

			onTouchMove: function(e) {
				var t0, t1, changed = false,
					dX, dY, distance,
					scrollSpeed, zoomSpeed;

				e.preventDefault();

				if(!this.multiTouch && e.touches.length == 1) {
					t0 = e.touches[0];
					scrollSpeed = this.getOpt('scrollSpeed');

					if(this.lastTouchX === null) this.lastTouchX = t0.clientX;
					if(this.lastTouchY === null) this.lastTouchY = t0.clientY;

					changed = this.updateBackgroundPosition(
						(this.lastTouchX - t0.clientX) * scrollSpeed,
						(this.lastTouchY - t0.clientY) * scrollSpeed
					);

					if(changed) {
						this.draw();
					}

					this.lastTouchX = t0.clientX;
					this.lastTouchY = t0.clientY;
				} else if(e.touches.length == 2) {
					t0 = e.touches[0];
					t1 = e.touches[1];
					dX = t1.clientX - t0.clientX;
					dY = t1.clientY - t0.clientY;
					distance = Math.sqrt(dX*dX + dY*dY);
					zoomSpeed = this.getOpt('zoomSpeed');

					if(Math.abs(distance - this.lastDistance) < this.getOpt('zoomDelay')) {
						return;
					}
					
					if(this.lastDistance) {
						if(this.lastDistance > distance) {
							this.updateProportion(zoomSpeed * this.proportion);
							this.updateBackgroundPosition(0, 0);
						} else {
							this.updateProportion(-zoomSpeed * this.proportion);
							this.updateBackgroundPosition(0, 0);
						}

						this.draw();
					}
					this.lastDistance = distance;
				}

			}
		}
	};

	global.ImageCrop = ImageCrop;
})(window);
