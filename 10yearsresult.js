


var scotland = ee.FeatureCollection("FAO/GAUL/2015/level1")
  .filter(ee.Filter.eq('ADM1_NAME', 'Scotland'));

Map.centerObject(scotland, 6);


var start = '2013-01-01';
var end = '2025-12-31';


var growingSeason = ee.Filter.calendarRange(4, 8, 'month');


var l8 = ee.ImageCollection("LANDSAT/LC08/C02/T1_L2");
var l9 = ee.ImageCollection("LANDSAT/LC09/C02/T1_L2");


var landsat = l8.merge(l9)
  .filterBounds(scotland)
  .filterDate(start, end)
  .filter(growingSeason);


function cloudMask(image) {

  var qa = image.select('QA_PIXEL');

  var cloud = qa.bitwiseAnd(1 << 3).neq(0);
  var cirrus = qa.bitwiseAnd(1 << 2).neq(0);

  var cloudCombined = cloud.or(cirrus);

  return cloudCombined.rename('cloud');
}


var clouds = landsat.map(cloudMask);


var cloudFrequency = clouds
  .mean()
  .multiply(100)
  .clip(scotland);


var vis = {
  min: 40,
  max: 80,
  palette: [
    '2c7bb6',
    'abd9e9',
    'ffffbf',
    'fdae61',
    'd7191c'
  ]
};

Map.addLayer(cloudFrequency, vis, 'Cloud Frequency (%)');




var dem = ee.Image('USGS/SRTMGL1_003').clip(scotland);


var elevBands = {
  "0–100 m": dem.gte(0).and(dem.lt(100)),
  "100–250 m": dem.gte(100).and(dem.lt(250)),
  "250–500 m": dem.gte(250).and(dem.lt(500)),
  "500+ m": dem.gte(500)
};


Object.keys(elevBands).forEach(function(name) {

  var masked = cloudFrequency.updateMask(elevBands[name]);

  var stats = masked.reduceRegion({
    reducer: ee.Reducer.mean(),
    geometry: scotland.geometry(),
    scale: 1000,
    maxPixels: 1e13
  });

  print(name, stats);

});




var lon = ee.Image.pixelLonLat().select('longitude');


var west = cloudFrequency.updateMask(lon.lt(-4.5));
var central = cloudFrequency.updateMask(lon.gte(-4.5).and(lon.lt(-2.5)));
var east = cloudFrequency.updateMask(lon.gte(-2.5));


function regionStats(image, name){

  var result = image.reduceRegion({
    reducer: ee.Reducer.mean(),
    geometry: scotland.geometry(),
    scale: 1000,
    maxPixels: 1e13
  });

  print(name, result);
}

regionStats(west, "Western Scotland");
regionStats(central, "Central Scotland");
regionStats(east, "Eastern Scotland");




Export.image.toDrive({
  image: cloudFrequency,
  description: 'Scotland_Cloud_Frequency_2013_2025',
  region: scotland.geometry(),
  scale: 1000,
  maxPixels: 1e13
});