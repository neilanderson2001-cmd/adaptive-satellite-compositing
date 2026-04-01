
var region = ee.Geometry.Rectangle([-4.2, 56.0, -3.8, 56.3]);  
var year = 2024;


var startMonth = 4;  
var endMonth   = 8;  

var bufferDays = 10; 
var scale = 10;      
var exportFolder = 'EarthEngineExports';


var rgbVis  = {min: 0, max: 0.30};
var ndviVis = {min: 0, max: 0.90, palette: ['#6e3b1f', '#d9c65a', '#2e7d32']};


Map.centerObject(region, 11);
Map.addLayer(region, {}, 'Region', false);


var s2 = ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED')
  .filterBounds(region)
  .filter(ee.Filter.calendarRange(year, year, 'year'))
  .filter(ee.Filter.calendarRange(startMonth, endMonth, 'month'))
  .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 70))
  .select(['B2','B3','B4','B8','B11','SCL']); 


function maskAndScore(image) {
  var refl = image.divide(10000);     
  var scl  = image.select('SCL');


  var clear = scl.eq(3)
    .or(scl.eq(4))
    .or(scl.eq(5))
    .or(scl.eq(6))
    .or(scl.eq(7));


  var hazeIndex = refl.select('B2').divide(refl.select('B11').add(0.001));
  var hazeFree = hazeIndex.lt(2.5);


  var bright = refl.select(['B2','B3','B4']).reduce(ee.Reducer.mean());
  var brightOK = bright.gt(0.01).and(bright.lt(0.50));

 
  var mask = clear.and(hazeFree).and(brightOK);

 
  var hazeScore = hazeIndex.multiply(-1);

  
  var target = ee.Image.constant(0.15);
  var brightScore = bright.subtract(target).abs().multiply(-1);

 
  var quality = hazeScore.add(brightScore).rename('cloudScore');

  return refl
    .updateMask(mask)
    .addBands(quality)
    .copyProperties(image, ['system:time_start', 'CLOUDY_PIXEL_PERCENTAGE']);
}


function hazeReduceRGB(rgb) {
  
  return rgb.expression('max(0, (img - 0.015) * 1.1)', {'img': rgb});
}


function makeMonthlyComposite(month) {
  month = ee.Number(month);

 
  var start = ee.Date.fromYMD(year, month, 1).advance(-bufferDays, 'day');
  var end   = ee.Date.fromYMD(year, month, 1).advance(1, 'month').advance(bufferDays, 'day');

  var monthly = s2.filterDate(start, end).map(maskAndScore);


  var composite = monthly.qualityMosaic('cloudScore').clip(region);

  
  var rgb = composite.select(['B4','B3','B2']);
  var rgbOut = hazeReduceRGB(rgb).rename(['B4','B3','B2']);


  var ndvi = composite.normalizedDifference(['B8','B4']).rename('NDVI');


  var label = ee.Date.fromYMD(year, month, 1).format('YYYY_MM');
  var labelText = label.getInfo();




  var validFrac = rgbOut.select('B4').mask().reduceRegion({
    reducer: ee.Reducer.mean(),
    geometry: region,
    scale: 30,
    maxPixels: 1e9
  }).get('B4');

  var cloudFreePct = ee.Number(validFrac).multiply(100);


  var avgCloud = monthly.aggregate_mean('CLOUDY_PIXEL_PERCENTAGE');


  var ndviStats = ndvi.reduceRegion({
    reducer: ee.Reducer.mean()
      .combine({reducer2: ee.Reducer.stdDev(), sharedInputs: true}),
    geometry: region,
    scale: 30,
    maxPixels: 1e9
  });


  print('Month:', labelText);
  print('   • Cloud-free % (masked pixels):', cloudFreePct);
  print('   • Avg Scene Cloud % (metadata):', avgCloud);
  print('   • NDVI mean:', ndviStats.get('NDVI_mean'));
  print('   • NDVI stdDev:', ndviStats.get('NDVI_stdDev'));


  Map.addLayer(rgbOut, rgbVis, 'RGB_' + labelText, false);
  Map.addLayer(ndvi, ndviVis, 'NDVI_' + labelText);


  Export.image.toDrive({
    image: rgbOut,
    description: 'Stirling_' + labelText + '_Adaptive_RGB',
    folder: exportFolder,
    region: region,
    scale: scale,
    maxPixels: 1e10,
    crs: 'EPSG:27700'
  });


  Export.image.toDrive({
    image: ndvi,
    description: 'Stirling_' + labelText + '_Adaptive_NDVI',
    folder: exportFolder,
    region: region,
    scale: scale,
    maxPixels: 1e10,
    crs: 'EPSG:27700'
  });


  return composite.set('month', label);
}


var months = ee.List.sequence(startMonth, endMonth);
months.getInfo().forEach(function(m) { makeMonthlyComposite(m); });

print('Adaptive monthly composites (RGB + NDVI) complete.');
