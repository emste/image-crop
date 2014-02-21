var ImageCrop = function($targetElement, source, options) {
	this.$targetElement = $targetElement;
	this.source = source;

	if(!this.source.type.match('image.*')) {
		// TODO
		throw new Error('No image given');
	}

	this.fileReader = new FileReader();
	this.fileReader.onload = this.callbacks.onFileReaderLoad.bind(this);

	this.options = options;
};

ImageCrop.prototype = {
	$targetElement: null,
	source: null,
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

	init: function() {
		this.fileReader.readAsDataURL(this.source);
	},

	crop: function() {
		var canvas = document.createElement('canvas'),
			context = canvas.getContext('2d');

		canvas.width = this.targetWidth;
		canvas.height = this.targetHeight;

			context.scale(
				sx = (this.targetWidth / this.image.width) * (this.proportion / 100),
				sy = (this.targetHeight / this.image.height) * (this.proportion / 100)
			);

		context.drawImage(
			this.image,
			-this.backgroundPositionX / sx,
			-this.backgroundPositionY / sy,
			this.targetWidth / sx, this.targetHeight / sy,
			0, 0,
			this.targetWidth, this.targetHeight
		);

		glo = context;

	},

	show: function() {
		var proportionX, proportionY;

		if(!this.imageBase64 || !this.image || !this.image.width) {
			throw new Error('Image data not initialized!');
		}

		this.targetWidth  = this.$targetElement.width();
		this.targetHeight = this.$targetElement.height();

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

		this.$targetElement.append(this.canvas);
		/*
		this.$targetElement.css({
			'background-size': this.proportion + '%',
			'background-image': 'url('+ this.imageBase64 +')'
		});
		*/

		$(this.canvas)
			.bind('touchstart', this.callbacks.onTouchStart.bind(this))
			.bind('touchend', this.callbacks.onTouchEnd.bind(this))
			.bind('touchmove', this.callbacks.onTouchMove.bind(this));
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
		/*
		var maxX = this.targetWidth * (1 - (this.proportion / 100)),
			maxY = this.targetHeight * (1 - (this.proportion / 100)),

			newX = Math.max(maxX, Math.min(0, this.backgroundPositionX - dX)),
			newY = Math.max(maxY, Math.min(0, this.backgroundPositionY - dY)),

			changed = newX != this.backgroundPositionX || newY != this.backgroundPositionY;

		this.backgroundPositionX = newX;
		this.backgroundPositionY = newY;

		return changed;
		*/
		var maxX = -this.targetWidth + this.image.width,
			maxY = -this.targetHeight + this.image.width,

			newX = Math.min(maxX, Math.max(0, this.backgroundPositionX - dX)),
			newY = Math.min(maxY, Math.max(0, this.backgroundPositionY - dY)),

			changed = newX != this.backgroundPositionX || newY != this.backgroundPositionY;
		console.log(maxX, maxY);

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
			this.activeTouches = Math.min(this.activeTouches + 1);

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

			this.lastTouchX = this.lastTouchY = null;
		},

		onTouchMove: function(e) {
			var ev, t0, t1, changed = false;

			e.preventDefault();
			ev = e.originalEvent;

			if(!this.multiTouch && ev.touches.length == 1) {
				t0 = ev.touches[0];

				if(this.lastTouchX === null) this.lastTouchX = t0.clientX;
				if(this.lastTouchY === null) this.lastTouchY = t0.clientY;

				changed = this.updateBackgroundPosition(
					this.lastTouchX - t0.clientX,
					this.lastTouchY - t0.clientY
				);

				if(changed) {
					this.draw();
				}

				this.lastTouchX = t0.clientX;
				this.lastTouchY = t0.clientY;
			} else if(ev.touches.length == 2) {
				var t0 = ev.touches[0],
					t1 = ev.touches[1],
					dX = t1.clientX - t0.clientX,
					dY = t1.clientY - t0.clientY,
					distance = Math.sqrt(dX*dX + dY*dY);
				
				if(this.lastDistance) {
					if(this.lastDistance > distance) {
						this.updateProportion(.03);
						this.updateBackgroundPosition(-3, -3);
					} else {
						this.updateProportion(-.03);
						this.updateBackgroundPosition(3, 3);
					}

					this.draw();
				}
				this.lastDistance = distance;
			}

		}
	}
};

