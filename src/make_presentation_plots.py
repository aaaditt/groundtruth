import pandas as pd, numpy as np, warnings
import matplotlib; matplotlib.use('Agg')
import matplotlib.pyplot as plt
warnings.filterwarnings('ignore')
BAND='4.0-14.0'; DAYS=['Mon','Tue','Wed','Thu','Fri','Sat','Sun']
SRC='data/external/2020_Science_GlobalQuieting/PaperZero_RMS/'
OUT='outputs/plots/'
YL='How much the ground is shaking\n(relative to that city\'s busiest day)'

def load(f,tz,ld=None):
    d=pd.read_csv(SRC+f,index_col=0,parse_dates=True)[BAND].dropna()
    d.index=d.index.tz_localize('UTC').tz_convert(tz)
    if ld is not None: d=d[d.index<ld]
    return d

# ---- 1. New York: what a week looks like ----
tz='US/Eastern'
s=load('AM.R7885.00.EHZ.csv',tz,pd.Timestamp('2020-03-12',tz=tz))
df=pd.DataFrame({'v':s.values},index=s.index)
df['dow']=df.index.day_of_week; df['hour']=df.index.hour; df['date']=df.index.date
nd=df['date'].nunique()
p=df.groupby(['dow','hour'])['v'].median().unstack(); p=p/p.values.max()
fig,ax=plt.subplots(figsize=(10,5.4))
for i in range(5):
    ax.plot(p.columns,p.iloc[i],color='#8fa8c8',lw=1.7,zorder=1,
            label='Mon–Fri' if i==0 else None)
ax.plot(p.columns,p.iloc[5],color='#d62728',lw=3.2,label='Saturday',zorder=3)
ax.plot(p.columns,p.iloc[6],color='#ff8c1a',lw=3.2,label='Sunday',zorder=3)
ax.set_xlabel('Time of day (local)'); ax.set_xticks(range(0,25,3))
ax.set_xticklabels(['12am','3am','6am','9am','12pm','3pm','6pm','9pm','12am'])
ax.set_ylabel(YL)
ax.set_title(f'What a week looks like from underground\nOne seismometer in New York · {nd} ordinary days',
             fontsize=13,fontweight='bold')
ax.legend(fontsize=10,loc='lower right'); ax.grid(alpha=0.25)
plt.tight_layout(); plt.savefig(OUT+'newyork_weekly_rhythm.png',dpi=180); plt.close()
print('1 weekly rhythm  |',nd,'days')

# ---- 2. New York: every day, holidays marked ----
s2=load('AM.R7885.00.EHZ.csv',tz)
dly=pd.DataFrame({'v':s2.values},index=s2.index).resample('D')['v'].median().dropna()
dly=dly/dly.max(); dw=dly.index.day_of_week
fig,ax=plt.subplots(figsize=(12,5))
ax.plot(dly.index,dly.values,color='#b8cade',lw=0.9,zorder=1)
ax.scatter(dly.index[dw<5],dly.values[dw<5],s=16,color='#1f77b4',label='Weekday',zorder=2)
ax.scatter(dly.index[dw>=5],dly.values[dw>=5],s=16,color='#ff8c1a',label='Weekend',zorder=2)
for d,lab in [('2019-12-25','Christmas Day\n(a Wednesday)'),('2020-03-12','Lockdown begins')]:
    t=pd.Timestamp(d,tz=tz)
    ax.axvline(t,color='#d62728',ls='--',lw=1.4,alpha=.85,zorder=3)
    ax.annotate(lab,xy=(t,1.06),fontsize=9,color='#d62728',ha='center',va='bottom')
ax.set_ylabel(YL)
ax.set_title('Every dip is people\nNew York, October 2019 – May 2020',fontsize=13,fontweight='bold')
ax.legend(fontsize=10,loc='lower left'); ax.grid(alpha=.25); ax.set_ylim(.15,1.22)
plt.tight_layout(); plt.savefig(OUT+'newyork_daily_timeline.png',dpi=180); plt.close()
print('2 daily timeline |',len(dly),'days')

# ---- 3. quietest day worldwide ----
r=pd.read_csv('outputs/tables/weekly_profiles.csv')
c=r['quietest'].value_counts().reindex(DAYS).fillna(0)
fig,ax=plt.subplots(figsize=(8.5,4.8))
b=ax.bar(DAYS,c.values,color=['#c9c9c9']*4+['#d62728','#9467bd','#1f77b4'])
for bar,v in zip(b,c.values):
    if v>0: ax.text(bar.get_x()+bar.get_width()/2,v+2,int(v),ha='center',fontsize=11,fontweight='bold')
ax.set_ylabel('Number of cities'); ax.set_ylim(0,142)
ax.set_title('Which day is a city quietest?\n142 seismometers around the world',fontsize=13,fontweight='bold')
ax.grid(alpha=.22,axis='y')
ax.annotate('These five are\nnot a mistake',xy=(4,6),xytext=(3.2,52),fontsize=9.5,color='#d62728',
            ha='center',arrowprops=dict(arrowstyle='->',color='#d62728',lw=1.2))
plt.tight_layout(); plt.savefig(OUT+'global_quietest_day.png',dpi=180); plt.close()
print(f'3 quietest day   | {len(r)} cities')

# ---- 4. the weekend moves ----
fig,ax=plt.subplots(figsize=(10,5.4))
for co,ci,col,lw in [('State of Palestine','Salfit','#d62728',3.0),
                     ('Israel','Station Amatzia','#ff8c1a',3.0),
                     ('Saudi Arabia','Jeddah','#2ca02c',3.0),
                     ('India','Port Blair','#1f77b4',2.2),
                     ('Belgium',None,'#9467bd',2.2)]:
    sub=r[r.country==co]
    if ci: sub=sub[sub.city==ci]
    if sub.empty: continue
    row=sub.iloc[0]
    ax.plot(DAYS,[row[d] for d in DAYS],marker='o',lw=lw,color=col,
            label=f"{row['city']}, {row['country']}")
ax.axvspan(3.5,5.5,color='#d62728',alpha=.07)
ax.text(4.5,.455,'Friday + Saturday',ha='center',fontsize=9.5,color='#d62728')
ax.axvspan(5.5,6.5,color='#1f77b4',alpha=.09)
ax.text(6.0,.455,'Sunday',ha='center',fontsize=9.5,color='#1f77b4')
ax.set_ylabel(YL)
ax.set_title('The weekend moves\nSome countries rest on Friday — and the ground shows it',
             fontsize=13,fontweight='bold')
ax.legend(fontsize=9.5,loc='lower left'); ax.grid(alpha=.25); ax.set_ylim(.42,1.05)
plt.tight_layout(); plt.savefig(OUT+'weekend_signature.png',dpi=180); plt.close()
print('4 weekend moves  | done')
