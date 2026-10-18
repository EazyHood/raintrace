"""Arithmetic reference using Python datetime and Decimal, not the JS analysis module."""
import json, calendar
from pathlib import Path
from decimal import Decimal
root = Path(__file__).parent
cases = []
for filename in ['santa-marta.json', 'bogota.json']:
    source = json.loads((root / filename).read_text(encoding='utf-8'), parse_float=Decimal)
    records = source['properties']['parameter']['PRECTOTCORR']
    for year, first, last in [(2024,6,9), (2025,1,3), (2024,1,12)]:
        def total(y):
            values=[]
            for month in range(first,last+1):
                for day in range(1,calendar.monthrange(y,month)[1]+1):
                    if (month,day)==(2,29): continue
                    value=records[f'{y:04}{month:02}{day:02}']
                    assert isinstance(value,(int,Decimal)) and value>=0
                    values.append(value)
            return sum(values,Decimal(0))
        actual = total(year)
        baseline = sum([total(y) for y in range(1991,2021)],Decimal(0))/Decimal(30)
        delta = (actual-baseline)/baseline*100
        cases.append(dict(file=filename,config=dict(year=year,startMonth=first,endMonth=last,direction='higher',threshold=20),targetTotal=float(actual),baselineMean=float(baseline),changePct=float(delta)))
out=dict(method='Python datetime/calendar and Decimal sum; same documented calendar and baseline specification; separate implementation, not independent meteorological validation.',cases=cases)
(root/'independent-reference.json').write_text(json.dumps(out,indent=2)+'\n',encoding='utf-8')
print(f'{len(cases)} independently calculated reference cases saved.')
