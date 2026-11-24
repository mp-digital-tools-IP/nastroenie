"""Printable measurement form for the already cut stair opening."""
from pathlib import Path
import os
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import A4
from reportlab.lib.colors import HexColor
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.utils import ImageReader
root=Path(__file__).resolve().parent.parent
for tag,file in [('Regular','segoeui.ttf'),('Bold','segoeuib.ttf'),('Title','georgia.ttf')]:
    pdfmetrics.registerFont(TTFont(tag,str(Path(os.environ['WINDIR'])/'Fonts'/file)))
out=root/'Передача'/'Проём лестницы — лист обмера.pdf'
c=canvas.Canvas(str(out),pagesize=A4)
c.setTitle('ЖК Настроение — лист обмера лестничного проёма')
W,H=A4
ink='#22362a';muted='#58665a';line='#b3c0b4'
def text(x,top,t,font='Regular',size=10,color=ink):
 c.setFont(font,size);c.setFillColor(HexColor(color));c.drawString(x,H-top,t)
def rule(x,y,xx,yy,col=line,width=.6):
 c.setStrokeColor(HexColor(col));c.setLineWidth(width);c.line(x,H-y,xx,H-yy)
def lines(y,strings,size=10,spacing=17):
 for v in strings:text(38,y,v,size=size);y+=spacing
def head(page,title,sub):
 text(38,41,'ЖК НАСТРОЕНИЕ   /   ВЫЕЗДНОЙ ОБМЕР', 'Bold',9,muted)
 text(38,82,title,'Title',25);text(38,108,sub,size=10)
 rule(38,123,556,123);rule(38,796,556,796);text(38,815,'Размеры и отметки записывать в миллиметрах. Приложить фото с теми же обозначениями.',size=8,color=muted)
 text(539,815,f'{page}/2',size=8,color=muted)
def underline(y):rule(38,y,556,y)
head(1,'Фактический проём','Для обмерщика и конструктора. Перекрытие добавлено, вырез выполнен, лестница отсутствует.')
text(38,151,'Дата ____________________     Исполнитель ___________________________________________',size=10)
text(38,177,'Высотный репер _____________________     Неизменяемые стены для привязок ______________',size=10)
text(38,212,'1. Обозначьте четыре угла на плане и фотографиях','Bold',13)
lines(235,['Начните с угла со стороны входа и продолжайте в одном направлении. Зафиксируйте верхнюю',
           'и нижнюю кромки отдельно. Нанесите границу существующего и добавленного перекрытий.'])
c.setStrokeColor(HexColor(line));c.setDash(2,3);c.rect(38,H-413,518,143,stroke=1,fill=0);c.setDash()
text(48,291,'Эскиз с привязкой к двум стенам',size=9,color=muted)
text(38,443,'2. Привязки вершин в одной системе координат','Bold',13)
for i,w in enumerate(['Угол','Верх X','Верх Y','Низ X','Низ Y','№ фото']):
 text([44,126,210,294,378,463][i],471,w,'Bold',9)
for i,l in enumerate('АБВГ'):
 y=479+i*34;rule(38,y,556,y);text(47,y+21,l,size=10)
rule(38,615,556,615)
text(38,649,'3. Длины кромок и диагонали','Bold',13)
lines(678,['Верх   АБ ________   БВ ________   ВГ ________   ГА ________   АВ ________   БГ ________',
           'Низ     АБ ________   БВ ________   ВГ ________   ГА ________   АВ ________   БГ ________'],spacing=31)
text(38,756,'Наблюдаемые выступы, повреждения, препятствия ___________________________________',size=10)
c.showPage()
head(2,'Посадка лестницы','Совместите обмер с планом обоих уровней и проверьте высоту прохода в разрезах.')
def img(filename,x,top,w,h):
 im=ImageReader(root/'assets'/'overlays'/filename);iw,ih=im.getSize();k=min(w/iw,h/ih);c.drawImage(im,x+(w-iw*k)/2,H-top-ih*k,iw*k,ih*k,mask='auto')
img('cut.png',43,151,211,99);img('footprint.png',301,151,230,99)
text(46,274,'Лист 13 · отдельный вырез','Bold',10);text(46,291,'1060 × 1990 мм',size=10)
text(299,274,'Лист 08 · пятно лестницы','Bold',10);text(299,291,'2870 × 1780 мм',size=10)
lines(320,['Приведите оба контура и фактическую кромку к одним осям. Уточните, где вырезан монолит,',
           'где проходит край добавленного настила и как устроено опирание.'])
text(38,375,'4. Единый высотный разрез','Bold',13)
for i,l in enumerate(['Основание снизу ____________   Будущий чистый пол снизу ____________',
                      'Основание сверху ___________   Будущий чистый пол сверху ___________',
                      'Низ плиты в четырёх углах      А _________  Б _________  В _________  Г _________',
                      'Нижняя точка балки или выступа ____________   Привязка и фото ___________________']):
 text(38,403+i*25,l,size=10)
text(38,520,'5. Проверка прохода и выхода','Bold',13)
lines(548,['Снять разрезы по центру и обоим краям марша. Указать контрольные вертикали от поверхности',
           'готовой ступени до ближайшего препятствия, место ограждения и свободный выход в холл.'])
lines(597,['Контрольная точка           По оси                   Внутренняя сторона                Наружная сторона',
          'Первый поворот             __________          __________                           __________',
          'Под кромкой плиты       __________          __________                           __________',
          'Выход наверх                __________          __________                           __________'],size=9,spacing=19)
text(38,690,'Удлинённый эскиз · 15 подъёмов','Bold',10)
lines(708,['Точка Б расположена на шестой ступени, в 140 мм от внешнего торца нижнего поворота',
           'и в 330 мм от длинной наружной стороны. В принятой модели просвет здесь 1623 мм.',
           'После обмера пересчитать оба варианта. Заключение о несущей способности и опорах',
           'оформляет конструктор по результатам обследования.'],size=9,spacing=15)
c.save()
