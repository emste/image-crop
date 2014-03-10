Image resizing and clipping library for mobile devices
======

ImageCrop.js offers functionality to select a portion of an image by zooming and moving the original image inside a viewport. The resulting image can be exported as data url, image element or blob.
Works only for devices with touch events.

Usage
------
### Object creation
```javascript
var imageCrop = new ImageCrop(targetElement, options);
```
`targetElement` specifies the dom element that will serve as viewport for the current selection. It should be able to contain a `<canvas>` element (e.g. a div). `options` is an optional object that can be used to overwrite default configurations. See `defaults` in ImageCrop for possible values.

### Reading input file
```javascript
imageCrop.read(file);
```
`file` is of type `File` and can be retrieved from an HTML5 file dialog. See index.html for an example.

### Crop
There are three methods to get the currently visible selection:
- `getAsDataURL()` returns a base64 encoded data url
- `getAsImage()` returns an img element
- `getAsBlob()` returns the image as `Blob` and can be used as input for `FormData`

### Listening to certain events
You can add callback functions for different events by calling `addListener`:
```javascript
imageCrop.addListener(callback, context, event);
```
`callback` and `context` should be obvious, `event` can be one of the following:
- `ImageCrop.EVENT_ERROR_FILE_TYPE`
- `ImageCrop.EVENT_ERROR_IMAGE_SIZE`
- `ImageCrop.EVENT_IMAGE_LOADING`
- `ImageCrop.EVENT_IMAGE_LOADED`


Credits
------
- Exif.js by jseidelin: https://github.com/jseidelin/exif-js
- iOS rendering issue fix by stomita: https://github.com/stomita/ios-imagefile-megapixel
