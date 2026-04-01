# adaptive-satellite-compositing
Adaptive pixel-based compositing for cloud-free Sentinel-2 imagery
# Adaptive Satellite Compositing

This project develops an adaptive, pixel-based compositing framework to generate high-frequency, cloud-free Sentinel-2 imagery in persistently cloudy regions (Stirling, Scotland).

The method improves upon traditional scene-based masking by selecting the best available pixel based on spectral quality, significantly increasing usable data retention.

---

## Repository Structure

### Google Earth Engine Scripts

- **Final_Adaptive_BAP.js**  
  Main adaptive compositing algorithm (Best Available Pixel approach)

- **Baseline_SCL_V1.js**  
  Baseline compositing using standard Scene Classification Layer (SCL) masking

- **NDVI_Analysis.js**  
  NDVI generation and analysis from composite outputs

- **Histogram_Comparison.js**  
  Statistical comparison of V1 vs V2 composites

- **Cloud_Climatology_2013_2025.js**  
  Multi-year cloud persistence analysis over Scotland

---

### Additional Files

- **NDVI_analysis.ipynb**  
  Supporting notebook used for NDVI statistics and visualisation

- **Colab_Analysis_Description.txt**  
  Description of supplementary analysis performed in Google Colab

---

## How to Run the Code

### Google Earth Engine

1. Go to: https://code.earthengine.google.com/
2. Create a new script
3. Copy and paste the contents of the required `.js` file
4. Run the script

Note: A Google Earth Engine account is required.

---

### Google Colab (Optional)

1. Go to: https://colab.research.google.com/
2. Upload the `.ipynb` file
3. Run all cells

---

## Notes

- All scripts are organised to reflect the workflow presented in the dissertation.
- The main contribution of this project lies in shifting from scene-level masking to pixel-level quality-based compositing.
- All results, figures, and validation are presented in the final report.

---

## Author

Neil Anderson  
University of Strathclyde  
