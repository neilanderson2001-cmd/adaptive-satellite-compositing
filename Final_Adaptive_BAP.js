

var region = ee.Geometry.Rectangle([-4.2, 56.0, -3.8, 56.3]);
Map.centerObject(region, 10);

var year = 2024;
var startMonth = 4;    
var endMonth   = 8;     
var bufferDays = 10;    
var scale      = 10;
var exportFolder = 'EarthEngineExports';


var s2 = ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED')
  .filterBounds(region)
  .filter(ee.Filter.calendarRange(year, year, 'year'))
  .filter(ee.Filter.calendarRange(startMonth, endMonth, 'month'))
  .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 70))
  .select(['B2','B3','B4','B5','B11','SCL']);


function maskAndScore(image) {


  var refl = image.divide(10000);
  var scl  = image.select('SCL');


  var clear = scl.eq(3)   // shadow
    .or(scl.eq(4))        // vegetation
    .or(scl.eq(5))        // bare soil
    .or(scl.eq(6))        // water
    .or(scl.eq(7));       // unclassified


  var hazeIndex = refl.select('B2').divide(refl.select('B11').add(0.001));
  var hazeFree  = hazeIndex.lt(2.5);


  var bright = refl.select(['B2','B3','B4']).reduce(ee.Reducer.mean());
  var brightOK = bright.gt(0.01).and(bright.lt(0.50));


  var mask = clear.and(hazeFree).and(brightOK);


  var brightPenalty = bright.subtract(0.15).abs();
  var quality = hazeIndex.multiply(-1)
    .subtract(brightPenalty)
    .rename('cloudScore');

  return refl
    .updateMask(mask)
    .addBands(quality)
    .copyProperties(image, ['system:time_start', 'CLOUDY_PIXEL_PERCENTAGE']);
}


function cloudFreePercent(img, geom, scaleMeters) {

  var valid = img.select('B4').mask().reduceRegion({
    reducer: ee.Reducer.sum(),
    geometry: geom,
    scale: scaleMeters,
    maxPixels: 1e10
  }).get('B4');

  var total = ee.Image(1).rename('ones').reduceRegion({
    reducer: ee.Reducer.count(),
    geometry: geom,
    scale: scaleMeters,
    maxPixels: 1e10
  }).get('ones');

  return ee.Number(valid).divide(ee.Number(total)).multiply(100);
}


function makeMonthlyComposite(month) {

  month = ee.Number(month);

  var start = ee.Date.fromYMD(year, month, 1).advance(-bufferDays, 'day');
  var end   = ee.Date.fromYMD(year, month, 1).advance(1, 'month').advance(bufferDays, 'day');

  var monthly = s2.filterDate(start, end).map(maskAndScore);


  var composite = monthly.qualityMosaic('cloudScore').clip(region);


  var rgb = composite.select(['B4','B3','B2']);


  var hazeReduced = rgb.expression(
    'max(0, (img - 0.015) * 1.1)',
    {img: rgb}
  );


  var cfPct    = cloudFreePercent(hazeReduced, region, 30);
  var avgCloud = monthly.aggregate_mean('CLOUDY_PIXEL_PERCENTAGE');
  var nImages  = monthly.size();


  var labelText = ee.Date.fromYMD(year, month, 1).format('YYYY_MM').getInfo();


  print( labelText,
        '| Cloud-free %:', cfPct,
        '| Avg Scene Cloud % (meta):', avgCloud,
        '| Images used:', nImages);

  Map.addLayer(hazeReduced, {min: 0, max: 0.3}, 'V2_' + labelText);


  Export.image.toDrive({
    image: hazeReduced,
    description: 'Stirling_' + labelText + '_V2_Adaptive_BAP',
    folder: exportFolder,
    region: region,
    scale: scale,
    maxPixels: 1e10,
    crs: 'EPSG:27700'
  });

  return hazeReduced;
}


var months = ee.List.sequence(startMonth, endMonth);
months.getInfo().forEach(function(m){
  makeMonthlyComposite(m);
});

print('FINAL V2 monthly composites complete. Check Tasks tab to run exports.');
