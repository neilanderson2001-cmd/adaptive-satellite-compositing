
var region = ee.Geometry.Rectangle([-4.2, 56.0, -3.8, 56.3]);
var year = 2024;
var month = 6;
var bufferDays = 10;
var scale = 10;


function maskV1(image) {
  var refl = image.divide(10000);
  var scl = image.select('SCL');

  var clear = scl.eq(4) // vegetation
    .or(scl.eq(5))      // bare soil
    .or(scl.eq(6));     // water

  return refl.updateMask(clear)
    .copyProperties(image, ['system:time_start']);
}


var start = ee.Date.fromYMD(year, month, 1).advance(-bufferDays, 'day');
var end   = ee.Date.fromYMD(year, month, 1).advance(1, 'month').advance(bufferDays, 'day');


var coll = ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED')
  .filterBounds(region)
  .filterDate(start, end)
  .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 70))
  .select(['B2','B3','B4','B8','B11','SCL'])
  .map(maskV1);


var composite = coll.median().clip(region);

var rgb = composite.select(['B4','B3','B2']);
var ndvi = composite.normalizedDifference(['B8','B4']).rename('NDVI');


var b4 = composite.select('B4');
var b4Mask = b4.mask(); 


var validFrac = b4Mask.reduceRegion({
  reducer: ee.Reducer.mean(),
  geometry: region,
  scale: scale,
  maxPixels: 1e10
}).get('B4');

var validPct = ee.Number(validFrac).multiply(100);


var validArea = ee.Image.pixelArea()
  .updateMask(b4Mask)
  .reduceRegion({
    reducer: ee.Reducer.sum(),
    geometry: region,
    scale: scale,
    maxPixels: 1e10
  }).values().get(0);

var validAreaKm2 = ee.Number(validArea).divide(1e6);


var ndviStats = ndvi.reduceRegion({
  reducer: ee.Reducer.mean()
    .combine(ee.Reducer.minMax(), '', true)
    .combine(ee.Reducer.stdDev(), '', true),
  geometry: region,
  scale: scale,
  maxPixels: 1e10
});


var avgCloudMeta = ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED')
  .filterBounds(region)
  .filterDate(start, end)
  .aggregate_mean('CLOUDY_PIXEL_PERCENTAGE');


print(' V1 June Baseline Results');
print('Window:', start.format('YYYY-MM-dd'), 'to', end.format('YYYY-MM-dd'));
print('Valid pixel %:', validPct);
print('Valid area (km²):', validAreaKm2);
print('NDVI mean:', ndviStats.get('NDVI_mean'));
print('NDVI stdDev:', ndviStats.get('NDVI_stdDev'));
print('Avg scene cloud % (meta):', avgCloudMeta);


Map.centerObject(region, 10);
Map.addLayer(rgb, {min:0, max:0.3}, 'V1_June_RGB');
Map.addLayer(ndvi, {min:-0.2, max:0.8}, 'V1_June_NDVI');

Export.image.toDrive({
  image: rgb,
  description: 'Figure_5_1a_V1_June_RGB',
  folder: 'EarthEngineExports',
  region: region,
  scale: 10,
  maxPixels: 1e10,
  crs: 'EPSG:27700'
});

Export.image.toDrive({
  image: ndvi,
  description: 'Figure_5_1b_V1_June_NDVI',
  folder: 'EarthEngineExports',
  region: region,
  scale: 10,
  maxPixels: 1e10,
  crs: 'EPSG:27700'
});
