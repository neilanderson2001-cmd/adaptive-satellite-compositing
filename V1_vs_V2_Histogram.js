
var region = ee.Geometry.Rectangle([-4.2, 56.0, -3.8, 56.3]);
Map.centerObject(region, 11);

var year = 2024;
var month = 7;       
var bufferDays = 10;
var scale = 10;


var s2 = ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED')
  .filterBounds(region)
  .filter(ee.Filter.calendarRange(year, year, 'year'))
  .filter(ee.Filter.calendarRange(month, month, 'month'))
  .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 70))
  .select(['B2','B3','B4','B8','B11','SCL']);


function baselineMask(img){
  var refl = img.divide(10000);
  var scl = img.select('SCL');

  var clear = scl.eq(4).or(scl.eq(5)).or(scl.eq(6)).or(scl.eq(7)); // veg, soil, water, unclassified
  return refl.updateMask(clear).copyProperties(img, ['system:time_start']);
}

var base = s2.map(baselineMask).median().clip(region);
var baseNDVI = base.normalizedDifference(['B8','B4']).rename('NDVI');


function maskAndScore(image) {
  var refl = image.divide(10000);
  var scl  = image.select('SCL');

  var clear = scl.eq(3).or(scl.eq(4)).or(scl.eq(5)).or(scl.eq(6)).or(scl.eq(7));

  var hazeIndex = refl.select('B2').divide(refl.select('B11').add(0.001));
  var hazeFree  = hazeIndex.lt(2.5);

  var bright   = refl.select(['B2','B3','B4']).reduce(ee.Reducer.mean());
  var brightOK = bright.gt(0.01).and(bright.lt(0.50));

  var mask = clear.and(hazeFree).and(brightOK);

  var hazeScore = hazeIndex.multiply(-1);
  var brightScore = bright.subtract(0.15).abs().multiply(-1);
  var quality = hazeScore.add(brightScore).rename('cloudScore');

  return refl.updateMask(mask).addBands(quality).copyProperties(image, ['system:time_start']);
}

var start = ee.Date.fromYMD(year, month, 1).advance(-bufferDays, 'day');
var end   = ee.Date.fromYMD(year, month, 1).advance(1, 'month').advance(bufferDays, 'day');

var adaptive = s2.filterDate(start, end).map(maskAndScore).qualityMosaic('cloudScore').clip(region);
var adaptNDVI = adaptive.normalizedDifference(['B8','B4']).rename('NDVI');


var chart = ui.Chart.image.histogram({
  image: ee.Image.cat([
    baseNDVI.rename('Baseline'),
    adaptNDVI.rename('Adaptive')
  ]),
  region: region,
  scale: 30,
  minBucketWidth: 0.02
}).setOptions({
  title: 'NDVI Distribution: Baseline vs Adaptive (July 2024)',
  hAxis: {title: 'NDVI'},
  vAxis: {title: 'Pixel count'},
  lineWidth: 2
});

print(chart);


Map.addLayer(baseNDVI, {min:0, max:0.9, palette:['brown','yellow','green']}, 'Baseline NDVI', false);
Map.addLayer(adaptNDVI, {min:0, max:0.9, palette:['brown','yellow','green']}, 'Adaptive NDVI', true);
