"""groundtruth -- read a city's weekly rhythm from the seismic noise people make.

Modules:
  features   15-minute RMS -> one row of 25 features per LOCAL day
  calendars  which days are weekends / public holidays, per country (cited sources)
  models     the model, the cross-validation splitter, dataset loading
  stations   the station roster for live data (config/stations.yaml)

The experiment scripts that produce every reported number live in src/.
"""
__version__ = "0.2.0"
