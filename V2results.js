
var region = ee.Geometry.Rectangle([-4.2, 56.0, -3.8, 56.3]);


var start = ee.Date('2024-05-22');
var end   = ee.Date('2024-07-11'); 


var scale = 10; 


var s2 = ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED')
  .filterBounds(region)
  .filterDate(start, end)
  .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 70))
  .select(['B2','B3','B4','B5','B8','B11','SCL']);


function maskAndScore_V2(image) {
  var refl = image.divide(10000);
  var scl = image.select('SCL');


  var clear = scl.eq(3).or(scl.eq(4)).or(scl.eq(5)).or(scl.eq(6)).or(scl.eq(7));


  var hazeIndex = refl.select('B2').divide(refl.select('B11').add(0.001));
  var hazeFree = hazeIndex.lt(2.5);

 
  var bright = refl.select(['B2','B3','B4']).reduce(ee.Reducer.mean());
  var brightOK = bright.gt(0.01).and(bright.lt(0.5));


  var mask = clear.and(hazeFree).and(brightOK);

  
  var hazeScore = hazeIndex.multiply(-1);                
  var brightScore = bright.subtract(0.3).abs().multiply(-1); 
  var quality = hazeScore.add(brightScore).rename('cloudScore');

  return refl.updateMask(mask).addBands(quality);
}


var v2_masked = s2.map(maskAndScore_V2);
var v2_composite = v2_masked.qualityMosaic('cloudScore').clip(region);


Map.centerObject(region, 11);
Map.addLayer(region, {color: 'yellow'}, 'ROI', false);

Map.addLayer(
  v2_composite,
  {bands: ['B4','B3','B2'], min: 0, max: 0.3},
  'V2 Composite (RGB)'
);

Map.addLayer(
  v2_composite,
  {bands: ['B8','B4','B3'], min: 0, max: 0.35},
  'V2 Composite (False Colour)', false
);


var ndvi = v2_composite.normalizedDifference(['B8','B4']).rename('NDVI');
Map.addLayer(ndvi, {min: -0.2, max: 0.9}, 'NDVI (from composite)', false);




var validFrac = ee.Number(
  v2_composite.select('B4').mask().reduceRegion({
    reducer: ee.Reducer.mean(),
    geometry: region,
    scale: scale,
    maxPixels: 1e10
  }).get('B4')
);

var validPct = validFrac.multiply(100);


var regionAreaKm2 = ee.Number(region.area()).divide(1e6);
var validAreaKm2 = regionAreaKm2.multiply(validFrac);


var ndviStats = ndvi.reduceRegion({
  reducer: ee.Reducer.mean().combine({
    reducer2: ee.Reducer.stdDev(),
    sharedInputs: true
  }),
  geometry: region,
  scale: scale,
  maxPixels: 1e10
});

var ndviMean = ee.Number(ndviStats.get('NDVI_mean'));
var ndviStd  = ee.Number(ndviStats.get('NDVI_stdDev'));


var avgSceneCloud = ee.Number(
  s2.aggregate_mean('CLOUDY_PIXEL_PERCENTAGE')
);


print('Window:', start.format('YYYY-MM-dd'), 'to', end.format('YYYY-MM-dd'));
print('Valid pixel %:', validPct);
print('Valid area (km²):', validAreaKm2);
print('NDVI mean:', ndviMean);
print('NDVI stdDev:', ndviStd);
print('Avg scene cloud % (meta):', avgSceneCloud);


print('Images in collection:', s2.size());
