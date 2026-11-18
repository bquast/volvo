/* XC90 2004 automatic transmission: live 3D model, simple drive line physics, faults, diagnosis, VR and copilot.
   One classic script, no build step. three.js r147 (global THREE), OrbitControls, RoomEnvironment, copilot.js. */
(function(){
"use strict";
var $=function(id){return document.getElementById(id)};
function clamp(v,a,b){return v<a?a:v>b?b:v}
var reduce=window.matchMedia&&window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ---------- data ---------- */
/* Some names depend on the gearbox: aw = Aisin AW55-51 (2.5T, D5), gm = GM 4T65 (T6). */
var PARTS={
  engine:{name:{aw:"Engine (2.5T or D5)",gm:"Engine (T6)"},
    job:{aw:"Five cylinders, across the car. The 2.5T has a turbo; the D5 is a diesel. The gearbox is on the left side of the engine.",gm:"Six cylinders with two turbos, across the car. The gearbox is on the left side of the engine."},
    fail:"An engine with low power gives a low stall speed. That looks like a gearbox fault, but it is not.",
    check:"If the engine stops much below its normal stall speed with full gas against the brake, examine the engine first."},
  conv:{name:"Torque converter",
    job:"It connects the engine to the gearbox with oil. The pump half turns with the engine and pushes oil against the turbine half. The turbine turns the gearbox input shaft. At low speed the converter also increases the torque. A lock-up clutch inside connects the two halves at higher speed.",
    fail:"The lock-up clutch wears and causes shudder. Less frequently, the hub splines or the turbine break. Then the engine revs up, but no torque goes into the gearbox, in all positions.",
    check:"Look at the turbine speed with a diagnostic tool. If the engine turns but the turbine speed stays at zero in N, the turbine or its splines are broken. Metal particles in the ATF can come from the converter."},
  pump:{name:"Oil pump",
    job:{aw:"The converter hub turns the pump at engine speed. The pump takes ATF from the pan through the filter and makes the line pressure. Without pressure no clutch can apply.",gm:"The pump makes the line pressure from the ATF in the pan. Without pressure no clutch or band can apply. On the 4-speed a drive chain connects the converter to the gear sets; the input clutch is in the path for D and for R."},
    fail:"Wear makes the pressure low, most at idle and with hot ATF. Very low ATF lets the pump take in air. If the converter hub or the pump drive breaks, the pump does not turn at all.",
    check:"A shop connects a pressure gauge at the test port and reads the line pressure in D and R, at idle and with gas. Low pressure in all positions points to the pump, the filter, or the pressure control."},
  fwd:{name:{aw:"Forward clutch C1",gm:"Forward band"},
    job:{aw:"A pack of friction plates and steel plates. Oil pressure pushes a piston and squeezes the pack. C1 connects the input shaft to the gear sets. The gearbox uses C1 in all forward gears. Reverse does not use it.",gm:"A band around a drum of the gear set. A servo pulls it tight with oil pressure. The 4-speed uses it in 1st and 2nd gear. Reverse uses other elements."},
    fail:{aw:"The friction lining wears or burns, most after a time with low or old ATF. The piston seal can also leak. Then the clutch holds for a moment when it fills, and then it slips. The car moves a short distance and stops, and the engine revs up with gas.",gm:"The band lining wears or the servo seal leaks. Then the band holds for a moment when it applies, and then it slips. The car moves a short distance and stops, and the engine revs up with gas."},
    check:"Compare D and R. If R works and D slips, a forward element is the first suspect. A shop compares the pressure at the clutch with the line pressure. A burnt smell and dark ATF agree with worn plates. Usually the gearbox must come out for this repair."},
  owc:{name:{aw:"Low one-way clutch F2",gm:"1-2 roller clutch"},
    job:"A one-way clutch holds a part of the gear set in one direction and lets it turn free in the other direction. In 1st gear in D it gives the reaction for the gear. It needs no oil pressure.",
    fail:"The sprags or rollers wear or break. Then 1st gear in D has no reaction: the gear set turns, but the output does not.",
    check:"Use manual mode, gear 1. In manual 1st gear a brake or band also holds this part, for engine braking. If the car moves in manual 1 but not in D, the one-way clutch is the first suspect. Confirm with the repair data for your gearbox."},
  rev:{name:{aw:"Reverse elements C2, B3",gm:"Reverse band"},
    job:{aw:"In the application table of this gearbox family, reverse uses clutch C2 and brake B3. They drive the gear set the other way. C1 is not applied in R.",gm:"Reverse uses the input clutch and the reverse band. The forward band is not applied in R."},
    fail:"They wear like the other clutches. Reverse then slips or engages late.",
    check:"If R also slips, the cause is probably common to all positions: the ATF level, the pressure, the pump or the converter."},
  plan:{name:"Planetary gear sets",
    job:{aw:"Each set has a sun gear, planet gears on a carrier, and a ring gear. When a clutch or a brake holds one of these parts, the set gives a ratio. This 5-speed uses three sets. An output gear takes the drive to the differential.",gm:"Each set has a sun gear, planet gears on a carrier, and a ring gear. When a clutch or a band holds one of these parts, the set gives a ratio. This 4-speed uses two sets, and a third planetary set is the final drive."},
    fail:"Broken teeth or bearings make noise, often a whine or a grinding. A failure can lock the gearbox or let it turn free.",
    check:"Metal particles in the pan. A noise that changes with the road speed, not with the engine speed."},
  vb:{name:"Valve body and solenoids",
    job:"A block with oil channels and valves below the gearbox. The solenoids get commands from the TCM. They set the line pressure and send it to the correct clutch for each gear. The manual valve follows the selector lever.",
    fail:"Valves wear in their bores, and pressure leaks away. A solenoid can stick. Dirt from worn clutches blocks the small passages. The result is late engagement, harsh shifts, slip, or wrong pressure.",
    check:{aw:"Read the fault codes. A shop measures the line pressure. On this 5-speed the line pressure solenoid (SLT) and its valves are known wear points.",gm:"Read the fault codes. A shop measures the line pressure in D and R, at idle and with gas."}},
  atf:{name:"ATF, pan and filter",
    job:"ATF is the automatic transmission fluid. It transmits the torque in the converter, applies the clutches, lubricates and cools. The pan holds the supply. The filter is inside, on the pump inlet.",
    fail:"A low level lets the pump take in air, most in turns, on slopes and when the ATF is hot. Old ATF loses its friction properties.",
    check:"Check the level with the procedure for your VIN: engine at idle, lever in P, ATF at the correct temperature. Smell it and look at the colour on a white cloth. Look for leaks at the pan, the cooler lines and the drive shaft seals."},
  cooler:{name:"ATF cooler in the radiator",
    job:"Two lines take the ATF to a cooler in the radiator and back. The coolant takes the heat away.",
    fail:"If the cooler leaks inside the radiator, coolant mixes with the ATF. The ATF becomes pink and milky. The clutch linings swell and lose friction. The coolant level also goes down.",
    check:"Look at the ATF colour and at the coolant level. With milky ATF: replace the radiator, flush the gearbox several times, and expect damage to the clutches."},
  tcm:{name:"Gearbox control unit (TCM)",
    job:"It reads the engine speed, the turbine and output speed sensors, the selector position and the ATF temperature. It commands the solenoids. It also adapts the shift pressures to wear.",
    fail:"The unit itself fails rarely. It stores codes and can go to a limp mode with a fixed gear. A low battery voltage causes strange shift faults.",
    check:"Read the codes with a tool that reads the Volvo TCM, not only the engine codes. Compare the turbine speed and the output speed: the TCM uses them to find slip."},
  cable:{name:"Selector lever and cable",
    job:"The lever in the cabin moves a cable. The cable turns the selector lever on the gearbox. This moves the manual valve and the parking pawl. A position sensor tells the TCM the selected position.",
    fail:"The cable end or its bush can break or come off. Then the lever moves, but the gearbox stays in the last position, for example P.",
    check:"A person moves the selector lever. Look at the lever on the gearbox: it must move with each position. Compare with the position on the instrument display."},
  diff:{name:"Final drive and differential",
    job:"The output gear of the gearbox turns the ring gear of the differential. The differential lets the two front wheels turn at different speeds in a turn. It is an open differential: it gives the same torque to the two sides.",
    fail:"Teeth or the differential pins can break. Then the car does not move, and you often hear grinding.",
    check:"Put the front of the car on stands. With the lever in P, turn one front wheel by hand: the other front wheel must turn the other way. Noise and metal in the ATF also show damage."},
  shafts:{name:"Drive shafts",
    job:"Two shafts with constant velocity (CV) joints connect the differential to the front wheels. On the right side an intermediate shaft goes through the angle gear to a support bearing. The shafts engage in splines.",
    fail:"Worn or stripped splines, or a broken CV joint. Because the differential is open, all the torque goes to the free side. A FWD car then does not move. On an AWD car the rear wheels can still push.",
    check:"Look for a torn boot and grease. With the car on stands and the engine off, hold one front wheel and turn the other. Listen for clicks or grinding. Look at the splines when the shaft is out."},
  angle:{name:"Angle gear (bevel gear)",
    job:"On AWD cars it is on the right side of the gearbox. A splined sleeve connects it to the differential housing. It turns the drive 90 degrees to the propeller shaft.",
    fail:"The splined sleeve wears and strips. Then the AWD stops, but the front wheels still drive. The oil can leak, and then the gears wear.",
    check:"If the front wheels drive but the propeller shaft does not turn, examine the sleeve. A stripped sleeve alone does not stop the car."},
  haldex:{name:"Propeller shaft and Haldex",
    job:"The propeller shaft turns the input of the Haldex coupling at the rear axle. When the front wheels turn faster than the rear wheels, a pump in the coupling presses a clutch pack. Then torque goes to the rear final drive.",
    fail:"The coupling pump or its filter fails, and the rear wheels get no torque. A seized centre bearing, coupling or rear final drive can hold the car.",
    check:"On a lift, turn the propeller shaft by hand in N. It must turn freely. Read the AWD codes."},
  brakes:{name:"Brakes and parking brake",
    job:"A disc and a caliper at each wheel. The parking brake is a small drum inside each rear disc. A pedal operates it with cables.",
    fail:"On a car that stood for a long time, a caliper piston or the parking brake shoes can seize. The car then pushes against the brakes and does not roll.",
    check:"Release the parking brake. Put the lever in N and push the car. After a short drive, carefully feel which wheel is hot. Look at the parking brake cables at the rear."}
};
var ORDER=["fwd","owc","rev","conv","pump","plan","vb","atf","cooler","tcm","cable","diff","shafts","angle","haldex","brakes","engine"];
var SHORT={fwd:{aw:"C1",gm:"Fwd band"},owc:{aw:"F2",gm:"Roller"},rev:{aw:"C2 B3",gm:"Rev band"},conv:"Converter",pump:"Pump",plan:"Gears",vb:"Valves",atf:"ATF",cooler:"Cooler",tcm:"TCM",cable:"Cable",diff:"Diff",shafts:"Shafts",angle:"Angle gr",haldex:"Haldex",brakes:"Brakes",engine:"Engine"};
var FAULTS=["none","fwd","owc","lowatf","coolant","pressure","pump","shaft","held","cable"];
var FNAME={none:"No fault",fwd:{aw:"Forward clutch slips",gm:"Forward band slips"},owc:"One-way clutch",lowatf:"ATF low",coolant:"Coolant in ATF",pressure:"Low line pressure",pump:"Pump does not turn",shaft:"Drive shaft spline",held:"Car is held",cable:"Selector cable"};
var FSHORT={none:"No fault",fwd:"Fwd slips",owc:"One-way",lowatf:"ATF low",coolant:"Coolant",pressure:"Low press.",pump:"No pump",shaft:"Shaft",held:"Held",cable:"Cable"};
var HINTS={
  none:"All parts are good. Put the lever in D and release the brake. The car creeps.",
  fwd:{aw:"C1 fills and holds for a moment. Then oil leaks out at the piston seal and the pressure goes down. Compare D with R.",gm:"The forward band holds for a moment. Then oil leaks out at the servo seal and the band slips. Compare D with R."},
  owc:"1st gear in D has no reaction. Compare D with R and with manual 1.",
  lowatf:"The pump takes in air. The pressure is low and it changes all the time. Engagement is late.",
  coolant:"Coolant in the ATF. The clutches have low friction. They hold at idle, but slip with gas, in D and in R.",
  pressure:"The line pressure does not go up with gas. At idle the clutch holds. With more gas it slips.",
  pump:"The pump does not turn. There is no pressure. No position drives the car.",
  shaft:"The right drive shaft turns free in its spline. The open differential sends the torque to that side. Switch AWD off and on to compare.",
  held:"A seized brake or a seized part of the drive line holds the car. The gearbox is good. Do the push test in N.",
  cable:"The cable is off at the gearbox. The lever moves, but the gearbox stays in P."
};
var SHINT={
  P:"P: the parking pawl locks the gearbox output. No clutch is applied.",
  R:"R: the reverse elements apply. Release the brake pedal to back up.",
  N:"N: no clutch is applied. Push the car to see if it rolls freely.",
  D:"D: the forward element applies, and the gearbox starts in 1st gear. Release the brake pedal and give gas.",
  M1:"Manual 1: the gearbox holds 1st gear. A brake also holds the part that the one-way clutch holds in D."
};
var S={sel:"P",gas:0,brake:false,engine:true,fault:"none",gb:"aw",awd:true,body:0,explode:false,k:0,kt:0,flow:true,part:"fwd",slow:false,push:0,t:0,vr:false,auto:false};
function nm(v){return typeof v==="string"?v:v[S.gb]}
function pName(id){return nm(PARTS[id].name)}

/* ---------- simulation ---------- */
/* Units: rad/s, N·m, N, m, s. Values are examples that give a believable result. */
var GBD={aw:{g1:13.6,g2:7.6,gr:-12.6,tmax:320},gm:{g1:9.8,g2:5.6,gr:-7.4,tmax:380}};
var RPM=30/Math.PI, M=2100, RW=0.37, JE=0.22, JT=0.05, KC=80, FRR=330, FBR=420, KFLEX=90000, PLAY=0.07, LEAKT=0.07, HMAX=900;
var PH={hx:0,we:780/RPM,wt:0,v:0,x:0,xe:0,ve:0,pl:0,pc:0,te:0,heat:0,gear:1,hcap:0,box:"P",held:false,fd:0,tcl:0,tcap:0,tt:0,te_:0,slip:0,slipAt:"",free:0,carrier:0,lock:false,end:false,boxLast:"P"};
var BUF=[], bufT=0, bufN=0; (function(){for(var i=0;i<300;i++)BUF.push([780,0,0])})();
var F={};
function engTq(rpm,gas){
  if(!S.engine)return -(25+rpm*0.01);
  var gov=clamp((780-rpm)*0.35+18,0,110), t=Math.max(gov,gas*GBD[S.gb].tmax*clamp(rpm/900,0.35,1));
  if(rpm>6200)t=0;
  return t-(9+rpm*0.004);
}
function kconv(){var d=GBD[S.gb];return d.tmax/Math.pow(S.gb==="aw"?2300:2450,2)}
function boxPos(){return S.fault==="cable"?"P":S.sel}
function ratio(){var d=GBD[S.gb], b=PH.box; if(b==="R")return d.gr; if(b==="D"||b==="M1")return PH.gear===2?d.g2:d.g1; return 0}
function step(dtReal){
  var dt=dtReal*(S.slow?0.3:1); S.t+=dt;
  var f=S.fault;
  if(S.push>0)S.push=Math.max(0,S.push-dt);
  var nb=boxPos(); if(nb!==PH.box){PH.box=nb; PH.te=0; PH.hcap=0}
  var drive=PH.box==="R"||PH.box==="D"||PH.box==="M1";
  PH.te+=dt;
  if(PH.box==="D"){if(PH.gear===1&&PH.v>4.4)PH.gear=2; else if(PH.gear===2&&PH.v<2.8)PH.gear=1} else PH.gear=1;
  if(PH.x>22&&!PH.end){PH.end=true} if(PH.end&&Math.abs(PH.v)<0.05&&!drive)PH.end=false;
  var brake=S.brake||PH.end;
  /* line pressure */
  var rpmE=PH.we*RPM, pumpOK=S.engine&&f!=="pump";
  var plT=pumpOK?(3.8+11*S.gas)*clamp((rpmE-200)/400,0,1):0;
  if(f==="pressure")plT=Math.min(plT,1.7+1.2*S.gas);
  if(f==="lowatf")plT*=0.42+0.22*Math.sin(S.t*6.3)+0.14*Math.sin(S.t*17.1);
  PH.pl+=(plT-PH.pl)*Math.min(1,dt*12);
  /* pressure at the applied element: fill, then hold. With a leaking seal the pressure goes down after the fill. */
  var fill=f==="lowatf"?1.6:0.32, pcT=0, leak=f==="fwd"&&(PH.box==="D"||PH.box==="M1");
  if(drive&&PH.pl>0.3){
    pcT=PH.te<fill?Math.min(leak?0.3:0.5,PH.pl):PH.pl;
    if(leak&&PH.te>=fill)pcT=Math.min(PH.pl,0.95)*Math.exp(-(PH.te-fill)/LEAKT)+0.02;
  }
  PH.pc+=(pcT-PH.pc)*Math.min(1,dt*(leak&&pcT<PH.pc?16:9));
  var mu=(f==="coolant"?0.26:1)*(1-0.35*clamp(PH.heat/160,0,1));
  var tcap=drive?PH.pc*KC*mu:0, path=1e9, slipAt="clutch";
  if(f==="owc"&&PH.box==="D"&&PH.gear===1){tcap=0;slipAt="owc"}
  var G=ratio();
  if(f==="shaft"&&drive){
    path=S.awd?PH.hcap/Math.abs(G||1):0;
    if(path<tcap){tcap=path;slipAt="diff"}
  }
  if(!drive)tcap=0;
  /* vehicle: parking pawl, brakes, rolling resistance. "Car is held": free play of PLAY, then a seized part holds. */
  var park=PH.box==="P", held=f==="held";
  var hold0=park?1e12:(brake?26000:0)+FBR, kin=FRR+(brake?14000:0);
  var fext=S.push>0?700:0;
  var K=kconv();
  var n=Math.max(1,Math.ceil(dt/0.001)), h=dt/n, tclA=0, fdA=0, ttA=0, teA=0, stat=false, slipping=false;
  for(var i=0;i<n;i++){
    var we=Math.max(PH.we,0), wt=PH.wt, v=PH.v, st=false, slp=false;
    var sr=we>5?wt/we:1, x=1-sr, cap=x>=0?Math.min(1,x*2.4):Math.max(-1.5,x*2.4);
    var Ti=K*Math.pow(we*RPM,2)*cap; if(we<=5&&Math.abs(wt)<=5)Ti=0;
    var TR=Ti>0&&sr<0.86?2.1-1.28*sr:1, Tt=Ti*TR;
    var Te=engTq(we*RPM,S.engine?S.gas:0);
    PH.we=Math.max(0,we+(Te-Ti)/JE*h);
    var Tcl=0, Fd=0, wout=G?v*G/RW:0;
    /* the seized part: a wall at the end of the free play */
    var dx=PH.x-PH.hx, Fguess=(tcap>0&&G?Math.sign(Tt*G):0)*1+fext;
    var wall=held&&((dx>=PLAY&&Fguess>0)||(dx<=-PLAY&&Fguess<0));
    var holdS=hold0+(wall?30000:0);
    if(wall&&((dx>=PLAY&&v>0)||(dx<=-PLAY&&v<0))){PH.v=v=0; wout=0; PH.x=PH.hx+(dx>0?PLAY:-PLAY)}
    if(tcap<=0||!G){
      PH.wt=wt+(Tt-(1.5+Math.abs(wt)*0.006)*Math.sign(wt))/JT*h; slp=drive;
    }else{
      var dw=wt-wout, locked=Math.abs(dw)<0.6;
      if(locked){
        var Fdl=Tt*G/RW;
        if(Math.abs(v)<0.004&&Math.abs(Fdl+fext)<=holdS){Tcl=Tt; st=true}
        else{var me=M+JT*G*G/(RW*RW), fr=Math.abs(v)>0.004?Math.sign(v)*kin:Math.sign(Fdl+fext)*kin; Tcl=Tt-JT*((Fdl+fext-fr)/me)*G/RW}
        if(Math.abs(Tcl)>tcap){Tcl=tcap*Math.sign(Tcl);locked=false;st=false}
      }
      if(locked){
        Fd=Tcl*G/RW;
        if(st){PH.v=0;PH.wt=0}
        else{var me2=M+JT*G*G/(RW*RW), F1=Tt*G/RW+fext, fr2=Math.abs(v)>0.004?Math.sign(v)*kin:Math.sign(F1)*kin;
          var vn=v+(F1-fr2)/me2*h; if(v!==0&&Math.sign(vn)!==Math.sign(v)&&Math.abs(F1)<holdS)vn=0; PH.v=vn; PH.wt=vn*G/RW}
      }else{
        slp=true;
        if(Tcl===0)Tcl=tcap*Math.sign(Math.abs(dw)>0.01?dw:Tt);
        PH.wt=wt+(Tt-Tcl)/JT*h;
        Fd=Tcl*G/RW;
      }
    }
    if(slp||tcap<=0||!G){
      /* the vehicle alone: the clutch slips, or no clutch is applied */
      var F0=Fd+fext, vv=PH.v;
      if(Math.abs(vv)<0.004){if(Math.abs(F0)<=holdS){PH.v=0;st=true}else PH.v=vv+(F0-Math.sign(F0)*kin)/M*h}
      else{var vn2=vv+(F0-Math.sign(vv)*kin)/M*h; if(Math.sign(vn2)!==Math.sign(vv))vn2=0; PH.v=vn2}
    }
    PH.x+=PH.v*h;
    /* tyres, mounts and play in the drive line flex when the car is held */
    var Fh=Fd+fext, xt=st?clamp(Fh/KFLEX,-0.08,0.08):0;
    if(park&&st)xt=clamp(Fh/KFLEX,-0.025,0.025);
    var ae=(xt-PH.xe)*38-PH.ve*5.5; PH.ve+=ae*h; PH.xe+=PH.ve*h;
    if(slp&&drive&&tcap>0)PH.heat+=Math.abs(Tcl*(PH.wt-wout))*h/2200;
    if(f==="shaft"&&S.awd&&drive&&slp&&Math.abs(PH.wt-wout)>3)PH.hcap=Math.min(HMAX,PH.hcap+2400*h);
    tclA+=Tcl; fdA+=Fd; ttA+=Tt; teA+=Te; stat=st; slipping=slp;
  }
  PH.heat-=PH.heat*0.06*dt;
  PH.tcl=tclA/n; PH.fd=fdA/n; PH.tt=ttA/n; PH.te_=teA/n; PH.tcap=tcap; PH.held=stat&&Math.abs(PH.fd+fext)>300;
  var wo=G?PH.v*G/RW:0;
  PH.slip=drive&&G?(PH.wt-wo)*RPM:0;
  PH.slipAt=drive&&Math.abs(PH.slip)>40?slipAt:"";
  /* the carrier of the differential, and the free side when a spline is stripped */
  var ww=PH.v/RW;
  PH.carrier=(f==="shaft"&&drive&&G&&PH.slipAt==="diff")?PH.wt/G:ww;
  PH.free=2*PH.carrier-ww;
  bufT+=dt; while(bufT>=0.02){bufT-=0.02; BUF.push([PH.we*RPM,Math.max(0,PH.wt*RPM),Math.abs(wo*RPM)]); bufN++; if(BUF.length>300)BUF.shift()}
  F={box:PH.box,gear:PH.gear,drive:drive,rpmE:PH.we*RPM,rpmT:Math.max(0,PH.wt*RPM),rpmO:Math.abs(wo*RPM),pl:PH.pl,pc:drive?PH.pc:0,slip:PH.slip,slipAt:PH.slipAt,
     held:PH.held,kmh:PH.v*3.6,moved:(PH.x+PH.xe)*100,roll:PH.x*100,brake:brake,end:PH.end,fd:PH.fd,tcap:tcap,heat:PH.heat,G:G};
}
function resetPhys(){PH.we=780/RPM;PH.wt=0;PH.v=0;PH.x=0;PH.xe=0;PH.ve=0;PH.pl=0;PH.pc=0;PH.te=0;PH.heat=0;PH.gear=1;PH.hcap=0;PH.end=false;PH.hx=0;S.pushX=0;BUF.length=0;for(var i=0;i<300;i++)BUF.push([780,0,0])}

function cm(v){var r=Math.round(v);return(r>0?"+":r<0?"−":"")+Math.abs(r)+" cm"}
function rpm(v){return Math.round(v/10)*10}
function boxName(){var b=F.box; if(b==="D")return"D · "+F.gear+(F.gear===1?"st":"nd"); if(b==="M1")return"Manual 1"; return b}
function statusText(f){
  var fe=nm(PARTS.fwd.name), ow=nm(PARTS.owc.name); fe=fe.charAt(0).toLowerCase()+fe.slice(1); ow=ow.charAt(0).toLowerCase()+ow.slice(1);
  if(!S.engine)return["Engine off. The oil pump does not turn, so there is no pressure and no clutch can apply. Start the engine.",false];
  if(S.fault==="cable"&&S.sel!=="P")return["The lever is in "+(S.sel==="M1"?"manual 1":S.sel)+", but the gearbox is still in P. The cable does not move the lever on the gearbox. The parking pawl holds the car.",true];
  if(f.end)return["End of the test area. The brake stops the car. Push Reset to go back.",false];
  if(S.fault==="pump"&&S.sel!=="P"&&S.sel!=="N")return["The engine runs, but the oil pump does not turn. Line pressure 0 bar. No clutch applies, in any position. The engine revs up freely.",true];
  if(f.box==="P")return["P: the parking pawl locks the gearbox output. The turbine turns with the engine, but no torque goes to the wheels.",false];
  if(f.box==="N"){
    if(S.push>0){var pd=Math.abs(PH.x-S.pushX);
      if(pd>0.25)return["N: two persons push. The car rolls freely, "+Math.round(pd*100)+" cm. The brakes and the drive line are free.",false];
      if(3-S.push<1.2)return["N: two persons push…",false];
      return["N: two persons push, but the car does not roll. It moves "+Math.round((pd+Math.abs(PH.xe))*100)+" cm, then it stops. Something holds the car: brakes, parking brake or a seized part.",true]}
    if(Math.abs(f.kmh)>0.3)return["N: no clutch is applied. The car rolls freely at "+Math.abs(f.kmh).toFixed(1)+" km/h.",false];
    return["N: no clutch is applied. Push the car to see if it rolls freely.",false];
  }
  var lev=f.box==="R"?"R":f.box==="M1"?"Manual 1":"D, "+f.gear+(f.gear===1?"st":"nd")+" gear";
  if(PH.te<(S.fault==="lowatf"?1.6:0.32))return[lev+": the valve body fills the "+(f.box==="R"?"reverse elements":fe)+" with oil.",false];
  if(f.slipAt==="owc")return[lev+": "+fe+" is applied, but "+ow+" turns freely. 1st gear has no reaction, so the output does not turn. Try manual 1 and R.",true];
  if(f.slipAt==="diff"){
    if(S.awd)return[lev+": the right drive shaft turns in its spline. The open differential sends all torque to that side. "+(PH.hcap>200?"The Haldex coupling closes and the rear wheels push the car.":"The propeller shaft turns, and the Haldex coupling starts to close."),true];
    return[lev+": the right drive shaft turns in its spline. The open differential sends all torque to that side. The left wheel gets no torque. The car does not move.",true];
  }
  if(f.slipAt==="clutch"){
    var el=f.box==="R"?"The reverse elements slip":(S.gb==="gm"?"The forward band slips":"C1 slips");
    var why=S.fault==="fwd"&&f.box!=="R"?" Line pressure "+f.pl.toFixed(1)+" bar, but only "+f.pc.toFixed(1)+" bar at the element: oil leaks out at the seal.":S.fault==="coolant"?" Coolant in the ATF lowers the friction.":S.fault==="pressure"?" Line pressure is only "+f.pl.toFixed(1)+" bar.":S.fault==="lowatf"?" The pump takes in air: "+f.pl.toFixed(1)+" bar.":"";
    return[lev+": "+el+". Turbine "+rpm(f.rpmT)+" rpm, but the wheels turn the gearbox at "+rpm(f.rpmO)+" rpm."+why,true];
  }
  if(f.held){
    var mv=Math.abs(Math.round(PH.xe*100));
    if(S.fault==="held"&&!S.brake)return[lev+": the gearbox holds and pushes, but something holds the car. It moved "+mv+" cm: the tyres and the mounts flex. Engine "+rpm(f.rpmE)+" rpm, turbine 0: the converter stalls.",true];
    if(f.brake)return[lev+": the brake holds the car. The converter slips: engine "+rpm(f.rpmE)+" rpm, turbine 0. This is normal for a short time.",false];
  }
  if(S.fault==="shaft"&&S.awd&&Math.abs(f.kmh)>0.2)return[lev+": the right drive shaft turns in its spline, so the front wheels get no torque. The Haldex coupling is closed. Only the rear wheels push the car, at "+Math.abs(f.kmh).toFixed(1)+" km/h.",true];
  if(Math.abs(f.kmh)>0.2)return[lev+": "+(f.box==="R"?"the reverse elements hold":fe+" holds")+". The torque goes to the wheels. The car moves at "+Math.abs(f.kmh).toFixed(1)+" km/h. Converter slip "+Math.round((1-f.rpmT/Math.max(f.rpmE,1))*100)+" %.",false];
  if(S.fault==="fwd"&&f.box!=="R")return[lev+": "+fe+" held for a moment, then the pressure went down. The car rolled "+Math.max(0,Math.round(f.roll))+" cm and stopped.",true];
  return[lev+": the element holds. The car stands still.",false];
}
function readouts(){
  var f=F;
  $("rG").textContent=boxName(); $("rG").className=S.fault==="cable"&&S.sel!=="P"?"bad":"";
  $("rE").textContent=rpm(f.rpmE)+" rpm";
  $("rP").textContent=f.pl.toFixed(1)+" bar";
  $("rC").textContent=f.drive?f.pc.toFixed(1)+" bar":"–"; $("rC").className=f.drive&&f.pc<f.pl*0.6&&PH.te>1?"bad":"air";
  $("rS").textContent=Math.abs(f.kmh).toFixed(1)+" km/h";
  $("rX").textContent=cm(f.moved);
  $("cE").textContent="Engine "+rpm(f.rpmE); $("cT").textContent="Turbine "+rpm(f.rpmT); $("cO").textContent="Wheels ×ratio "+rpm(f.rpmO);
  var msg=statusText(f), st=$("status");
  if(S.slow)msg=["Slow motion. "+msg[0],msg[1]];
  if(st.textContent!==msg[0])st.textContent=msg[0];
  st.classList.toggle("bad",msg[1]);
}

/* ---------- graph: three speeds ---------- */
var CH={hi:1000};
function chartTo(g,L,Tp,R,B,ch,fpx,lw){
  var hi=0,i; for(i=0;i<BUF.length;i++)hi=Math.max(hi,BUF[i][0],BUF[i][1],BUF[i][2]);
  hi=Math.max(1000,Math.ceil(hi*1.15/500)*500); ch.hi+=(hi-ch.hi)*0.15;
  function Y(p){return B-p/ch.hi*(B-Tp)}
  g.font=fpx+"px IBM Plex Mono, ui-monospace, monospace"; g.textBaseline="middle"; g.lineWidth=1;
  var st=ch.hi>4000?2000:ch.hi>2000?1000:500;
  for(var p=0;p<ch.hi;p+=st){g.strokeStyle="#27364f";g.beginPath();g.moveTo(L,Y(p));g.lineTo(R,Y(p));g.stroke();g.fillStyle="#94a3bd";g.fillText(p>=1000?(p/1000)+"k":String(p),L-fpx*2.4,Y(p))}
  [[2,"#69cfe6"],[1,"#e7edf6"],[0,"#f0b84a"]].forEach(function(t){
    g.strokeStyle=t[1]; g.lineWidth=lw; g.lineJoin="round"; g.beginPath();
    for(i=0;i<BUF.length;i++){var x=L+(R-L)*i/(BUF.length-1), y=Y(BUF[i][t[0]]); if(i)g.lineTo(x,y); else g.moveTo(x,y)}
    g.stroke(); var e=BUF[BUF.length-1][t[0]]; g.fillStyle=t[1]; g.beginPath(); g.arc(R-1,Y(e),lw*1.5,0,7); g.fill();
  });
  g.textBaseline="top";
}
function drawChart(){
  var c=$("chart"), w=c.clientWidth, h=c.clientHeight; if(!w)return;
  var dpr=Math.min(window.devicePixelRatio||1,2);
  if(c.width!==Math.round(w*dpr)){c.width=Math.round(w*dpr);c.height=Math.round(h*dpr)}
  var g=c.getContext("2d"); g.setTransform(dpr,0,0,dpr,0,0); g.clearRect(0,0,w,h);
  chartTo(g,30,6,w-4,h-6,CH,10,2);
}

/* ---------- interface ---------- */
var APPLY=false;
function remote(a,v){if(!APPLY&&window.Copilot&&Copilot.role==="copilot"){Copilot.send({a:a,v:v});return true}return false}
function pressed(id,attr,val){Array.prototype.forEach.call($(id).children,function(b){if(b.dataset[attr]!==undefined)b.setAttribute("aria-pressed",b.dataset[attr]===val?"true":"false")})}
function buildParts(){
  var box=$("parts"); box.textContent="";
  ORDER.forEach(function(id){
    if(id==="angle"&&!S.awd)return; if(id==="haldex"&&!S.awd)return;
    var b=document.createElement("button"); b.type="button"; b.dataset.id=id; b.textContent=pName(id);
    b.setAttribute("aria-pressed",S.part===id?"true":"false"); b.addEventListener("click",function(){select(id)}); box.appendChild(b)});
}
function select(id){
  if(remote("part",id))return;
  S.part=id;
  pressed("parts","id",id);
  var p=PARTS[id], card=$("card"); card.textContent="";
  var h=document.createElement("h3"); h.textContent=pName(id); card.appendChild(h);
  var dl=document.createElement("dl");
  [["What it does",nm(p.job)],["How it fails",nm(p.fail)],["How to examine it",nm(p.check)]].forEach(function(r){
    var w=document.createElement("div"), dt=document.createElement("dt"), dd=document.createElement("dd");
    dt.textContent=r[0]; dd.textContent=r[1]; w.appendChild(dt); w.appendChild(dd); dl.appendChild(w)});
  card.appendChild(dl);
}
function buildFaults(){
  var box=$("faults"); box.textContent="";
  FAULTS.forEach(function(fl){var b=document.createElement("button"); b.type="button"; b.dataset.fault=fl; b.textContent=nm(FNAME[fl]);
    b.setAttribute("aria-pressed",S.fault===fl?"true":"false"); box.appendChild(b)});
}
$("faults").addEventListener("click",function(e){var b=e.target.closest("button");if(b)setFault(b.dataset.fault)});
function setFault(fl){
  if(remote("fault",fl))return;
  S.fault=fl; PH.heat=0; PH.te=0; PH.hcap=0; PH.hx=PH.x;
  pressed("faults","fault",fl); $("hint").textContent=nm(HINTS[fl]);
}
function setSel(v){
  if(remote("sel",v))return;
  S.sel=v; pressed("sel","sel",v); $("shint").textContent=SHINT[v];
}
$("sel").addEventListener("click",function(e){var b=e.target.closest("button");if(b)setSel(b.dataset.sel)});
function setGas(v){if(remote("gas",v))return;S.gas=clamp(Math.round(v*20)/20,0,1);$("gas").value=Math.round(S.gas*100);$("gasOut").textContent=S.gas?Math.round(S.gas*100)+" %":"0 %"}
$("gas").addEventListener("input",function(){setGas(+this.value/100)});
function setBrake(on){if(remote("brake",on?1:0))return;S.brake=on;$("bBrake").setAttribute("aria-pressed",on?"true":"false")}
$("bBrake").addEventListener("click",function(){setBrake(!S.brake)});
function push(){if(remote("push"))return;S.push=3;S.pushX=PH.x}
$("bPush").addEventListener("click",push);
function setEngine(on){if(remote("engine",on?1:0))return;S.engine=on;if(!on)setGas(0);$("engine").textContent="Engine: "+(on?"on":"off");$("engine").setAttribute("aria-pressed",on?"true":"false")}
$("engine").addEventListener("click",function(){setEngine(!S.engine)});
function setSlow(v){if(remote("slow",v?1:0))return;S.slow=v;$("bSlow").setAttribute("aria-pressed",v?"true":"false")}
$("bSlow").addEventListener("click",function(){setSlow(!S.slow)});
function doReset(){if(remote("reset"))return;resetPhys();setGas(0);setBrake(false);S.push=0;setSel("P")}
$("reset").addEventListener("click",doReset);
function setGb(g){
  if(remote("gb",g))return;
  S.gb=g; pressed("gb","gb",g); buildFaults(); buildParts(); select(S.part); $("hint").textContent=nm(HINTS[S.fault]);
  updateEyebrow(); renderDiag(); if(window.__gbVis)window.__gbVis();
}
$("gb").addEventListener("click",function(e){var b=e.target.closest("button[data-gb]");if(b)setGb(b.dataset.gb)});
function setAwd(on){
  if(remote("awd",on?1:0))return;
  S.awd=on; $("bAwd").setAttribute("aria-pressed",on?"true":"false"); $("bAwd").textContent=on?"AWD":"FWD";
  if(!on&&(S.part==="angle"||S.part==="haldex"))S.part="diff";
  buildParts(); select(S.part); updateEyebrow(); if(window.__gbVis)window.__gbVis();
}
$("bAwd").addEventListener("click",function(){setAwd(!S.awd)});
function updateEyebrow(){$("eyebrow").textContent="Volvo XC90 · 2004 · "+(S.awd?"AWD":"FWD")+" · "+(S.gb==="aw"?"Aisin AW55-51 5-speed":"GM 4T65 4-speed")}
$("tabs").addEventListener("click",function(e){var b=e.target.closest("button");if(!b)return;showTab(b.dataset.tab)});
function showTab(t){$("side").setAttribute("data-tab",t);Array.prototype.forEach.call($("tabs").children,function(x){x.setAttribute("aria-pressed",x.dataset.tab===t?"true":"false")})}

/* ---------- diagnose: questions and a simple score ---------- */
var QS=[
  {id:"q1",t:"Lever in D at idle, brake released",o:[["ok","Moves normally"],["push","Pushes about 10 cm, then stops"],["none","Does not move at all"]]},
  {id:"q2",t:"In D, light gas to about 1500 rpm for 2 s",o:[["free","Engine revs up easily"],["load","Engine sounds loaded"],["drive","The car drives"]]},
  {id:"q3",t:"Lever in R at idle",o:[["ok","R works"],["bad","Same problem as D"]]},
  {id:"q4",t:"Manual mode, gear 1",o:[["ok","Moves"],["bad","Same as D"]]},
  {id:"q5",t:"Lever in N, two persons push the car",o:[["free","Rolls easily"],["held","Does not roll, or rocks back"]]},
  {id:"q6",t:"ATF on the dipstick",o:[["ok","Level good, red"],["low","Low"],["burnt","Dark, burnt smell"],["milky","Pink and milky"]]},
  {id:"q7",t:"Noise",o:[["none","No special noise"],["grind","Grinding or clicks at the front"],["whine","Whine that follows the engine"]]},
  {id:"q8",t:"Message on the display",o:[["none","No message"],["serv","Transmission service message"]]}
];
var ANS={q1:"push",q2:"nt",q3:"nt",q4:"nt",q5:"nt",q6:"nt",q7:"nt",q8:"nt"};
var PRIOR={fwd:0.22,owc:0.06,lowatf:0.14,coolant:0.06,pressure:0.1,pump:0.06,shaft:0.08,held:0.2,cable:0.08};
var LK={
  fwd:     {q1:{ok:.1,push:1,none:.6},q2:{free:1,load:.1,drive:.1},q3:{ok:1,bad:.15},q4:{ok:.1,bad:1},q5:{free:1,held:.1},q6:{ok:.5,low:.6,burnt:1,milky:.05},q7:{none:1,grind:.3,whine:.4},q8:{none:.7,serv:.7}},
  owc:     {q1:{ok:.1,push:.5,none:1},q2:{free:1,load:.05,drive:.1},q3:{ok:1,bad:.1},q4:{ok:1,bad:.1},q5:{free:1,held:.1},q6:{ok:.6,low:.5,burnt:.7,milky:.05},q7:{none:.8,grind:.5,whine:.4},q8:{none:.7,serv:.6}},
  lowatf:  {q1:{ok:.3,push:.8,none:.7},q2:{free:.9,load:.1,drive:.3},q3:{ok:.4,bad:1},q4:{ok:.3,bad:1},q5:{free:1,held:.1},q6:{ok:.1,low:1,burnt:.6,milky:.05},q7:{none:.6,grind:.3,whine:.8},q8:{none:.6,serv:.8}},
  coolant: {q1:{ok:.3,push:.7,none:.5},q2:{free:.9,load:.2,drive:.3},q3:{ok:.4,bad:1},q4:{ok:.3,bad:1},q5:{free:1,held:.1},q6:{ok:.1,low:.4,burnt:.5,milky:1},q7:{none:1,grind:.3,whine:.4},q8:{none:.6,serv:.8}},
  pressure:{q1:{ok:.5,push:.6,none:.4},q2:{free:1,load:.1,drive:.2},q3:{ok:.4,bad:1},q4:{ok:.4,bad:1},q5:{free:1,held:.1},q6:{ok:.7,low:.5,burnt:.6,milky:.05},q7:{none:1,grind:.3,whine:.4},q8:{none:.5,serv:1}},
  pump:    {q1:{ok:.02,push:.2,none:1},q2:{free:1,load:.05,drive:.02},q3:{ok:.05,bad:1},q4:{ok:.05,bad:1},q5:{free:1,held:.1},q6:{ok:.5,low:.8,burnt:.7,milky:.05},q7:{none:.5,grind:.6,whine:1},q8:{none:.6,serv:.7}},
  shaft:   {q1:{ok:.1,push:.4,none:.8},q2:{free:.9,load:.3,drive:.3},q3:{ok:.1,bad:1},q4:{ok:.1,bad:1},q5:{free:1,held:.1},q6:{ok:1,low:.4,burnt:.4,milky:.05},q7:{none:.5,grind:1,whine:.2},q8:{none:1,serv:.2}},
  held:    {q1:{ok:.05,push:1,none:.6},q2:{free:.1,load:1,drive:.2},q3:{ok:.1,bad:1},q4:{ok:.1,bad:1},q5:{free:.05,held:1},q6:{ok:1,low:.4,burnt:.4,milky:.05},q7:{none:.8,grind:.4,whine:.3},q8:{none:1,serv:.2}},
  cable:   {q1:{ok:.05,push:.3,none:1},q2:{free:1,load:.05,drive:.02},q3:{ok:.2,bad:1},q4:{ok:.1,bad:1},q5:{free:.1,held:1},q6:{ok:1,low:.4,burnt:.4,milky:.05},q7:{none:1,grind:.3,whine:.3},q8:{none:.7,serv:.8}}
};
var WHY={
  fwd:"Agrees with: it engages, rolls a little, then slips. The engine revs up easily. R works.",
  owc:"Agrees with: no drive in D, but manual 1 and R work.",
  lowatf:"Agrees with: late engagement, slip in D and in R, a low level on the dipstick.",
  coolant:"Agrees with: pink, milky ATF and slip in all positions.",
  pressure:"Agrees with: holds at idle, slips with gas, in D and in R. A service message is probable.",
  pump:"Agrees with: no drive in any position. The engine revs up easily. Often a whine.",
  shaft:"Agrees with: grinding at the front, no drive, ATF good. An AWD car can still push a little.",
  held:"Agrees with: the car pushes about 10 cm against something. The engine sounds loaded. It does not roll in N.",
  cable:"Agrees with: the gearbox stays in P for all lever positions. The car does not roll in N."
};
var QBOX=$("qs");
QS.forEach(function(q){
  var w=document.createElement("div"); w.className="q";
  var t=document.createElement("div"); t.className="qt"; t.textContent=q.t; w.appendChild(t);
  var c=document.createElement("div"); c.className="chips"; c.dataset.q=q.id;
  q.o.concat([["nt","Not tested"]]).forEach(function(o){var b=document.createElement("button"); b.type="button"; b.dataset.a=o[0]; b.textContent=o[1]; if(o[0]==="nt")b.className="nt";
    b.setAttribute("aria-pressed",ANS[q.id]===o[0]?"true":"false"); c.appendChild(b)});
  c.addEventListener("click",function(e){var b=e.target.closest("button");if(!b)return;ANS[q.id]=b.dataset.a;
    Array.prototype.forEach.call(c.children,function(x){x.setAttribute("aria-pressed",x===b?"true":"false")}); renderDiag()});
  w.appendChild(c); QBOX.appendChild(w);
});
function scores(){
  var out=[], sum=0;
  Object.keys(PRIOR).forEach(function(k){var s=PRIOR[k]; QS.forEach(function(q){var a=ANS[q.id]; if(a!=="nt")s*=LK[k][q.id][a]});
    if(k==="shaft"&&!S.awd&&ANS.q1==="push")s*=0.5; out.push([k,s]); sum+=s});
  out.forEach(function(o){o[1]/=sum}); out.sort(function(a,b){return b[1]-a[1]}); return out;
}
function renderDiag(){
  var box=$("rank"); box.textContent="";
  scores().slice(0,5).forEach(function(o){
    var d=document.createElement("div"); d.className="rk";
    var n=document.createElement("span"); n.className="n"; n.textContent=nm(FNAME[o[0]]); d.appendChild(n);
    var pc=document.createElement("span"); pc.className="pc"; pc.textContent=Math.round(o[1]*100)+" %"; d.appendChild(pc);
    var bar=document.createElement("div"); bar.className="bar"; var i=document.createElement("i"); i.style.width=Math.round(o[1]*100)+"%"; bar.appendChild(i); d.appendChild(bar);
    var why=document.createElement("div"); why.className="why"; why.textContent=WHY[o[0]]; d.appendChild(why);
    var go=document.createElement("button"); go.type="button"; go.className="go"; go.textContent="Show in the model";
    go.addEventListener("click",function(){setFault(o[0]); doReset(); setTimeout(function(){setSel(o[0]==="cable"?"D":"D")},300); showTab("test")});
    d.appendChild(go); box.appendChild(d);
  });
}

buildFaults(); buildParts(); setFault("none"); setSel("P"); select("fwd"); updateEyebrow(); renderDiag(); step(0.016); readouts();

/* ---------- 3D scene ---------- */
var T=window.THREE, stage=$("stage"), canvas=$("gl"), renderer;
try{renderer=new T.WebGLRenderer({canvas:canvas,antialias:true})}catch(e){renderer=null}
if(!renderer){
  $("loading").textContent="This browser cannot show the 3D model. The controls and the text work without it.";
  setInterval(function(){step(0.033);readouts();drawChart();drawFlow(0.033)},33);
  return;
}
var V3=T.Vector3;
renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2));
renderer.outputEncoding=T.sRGBEncoding;
renderer.toneMapping=T.ACESFilmicToneMapping; renderer.toneMappingExposure=0.9;
renderer.shadowMap.enabled=true; renderer.shadowMap.type=T.PCFSoftShadowMap;
var scene=new T.Scene(); scene.background=new T.Color(0x0b1322); scene.fog=new T.Fog(0x0b1322,10,30);
var pmg=new T.PMREMGenerator(renderer); scene.environment=pmg.fromScene(new T.RoomEnvironment(),0.04).texture;
var camera=new T.PerspectiveCamera(36,1,0.05,50);
var controls=new T.OrbitControls(camera,canvas);
controls.enableDamping=true; controls.dampingFactor=0.08; controls.enablePan=false;
controls.minDistance=0.9; controls.maxDistance=13; controls.maxPolarAngle=2.25;
controls.autoRotate=!reduce; controls.autoRotateSpeed=0.5;
var FA=2.86, CRY=0.62, CRZ=2.98;
function homeView(mode){
  var tg, dir, d;
  if(mode==="below"){tg=new V3(0,0.4,1.5); dir=new V3(1.2,-0.75,1.3); d=4.3}
  else if(mode==="box"){tg=new V3(0.38,0.56,2.92); dir=new V3(1.0,1.55,1.25); d=camera.aspect<1.25?2.4:2.0}
  else{tg=new V3(0.15,0.65,1.9); dir=new V3(2.3,1.1,2.4); d=camera.aspect<1.25?6.2:5.3}
  controls.target.copy(tg); camera.position.copy(tg).addScaledVector(dir.normalize(),d); controls.update();
}
var sun=new T.DirectionalLight(0xffffff,1.1); sun.position.set(2.6,6,2.2); sun.target.position.set(0,0,1.4); sun.castShadow=true;
sun.shadow.mapSize.set(2048,2048); sun.shadow.camera.left=-4; sun.shadow.camera.right=4; sun.shadow.camera.top=4; sun.shadow.camera.bottom=-4; sun.shadow.camera.far=16; sun.shadow.bias=-0.0006;
scene.add(sun); scene.add(sun.target); scene.add(new T.HemisphereLight(0x9db4ff,0x0b1322,0.35));

/* level concrete test area: it moves below the car. The cyan line is where the front wheels started. */
var groundTex, startLine;
(function(){
  var c=document.createElement("canvas"); c.width=256; c.height=512; var g=c.getContext("2d");
  g.fillStyle="#1a2230"; g.fillRect(0,0,256,512);
  for(var i=0;i<2600;i++){var v=24+Math.random()*24|0; g.fillStyle="rgba("+v+","+(v+6)+","+(v+16)+",0.55)"; g.fillRect(Math.random()*256,Math.random()*512,1.5,1.5)}
  g.fillStyle="#0e131c"; g.fillRect(0,0,256,2); g.fillRect(127,0,2,512);
  groundTex=new T.CanvasTexture(c); groundTex.encoding=T.sRGBEncoding; groundTex.wrapT=T.RepeatWrapping; groundTex.repeat.set(1,20); groundTex.anisotropy=4;
  var gm=new T.Mesh(new T.PlaneGeometry(8,80),new T.MeshStandardMaterial({map:groundTex,roughness:0.95,metalness:0,envMapIntensity:0.2}));
  gm.rotation.x=-Math.PI/2; gm.position.z=6; gm.receiveShadow=true; scene.add(gm);
  var base=new T.Mesh(new T.CircleGeometry(60,48),new T.MeshBasicMaterial({color:0x0b1322})); base.rotation.x=-Math.PI/2; base.position.y=-0.01; scene.add(base);
  startLine=new T.Mesh(new T.PlaneGeometry(2.4,0.025),new T.MeshBasicMaterial({color:0x69cfe6,transparent:true,opacity:0.85})); startLine.rotation.x=-Math.PI/2; startLine.position.set(0,0.004,FA); scene.add(startLine);
})();

function Mt(color,metal,rough){return new T.MeshStandardMaterial({color:color,metalness:metal,roughness:rough,envMapIntensity:0.7})}
var steel=Mt(0x8c97a8,0.9,0.35), dark=Mt(0x2a3140,0.7,0.5), rubber=Mt(0x14161b,0.0,0.85), alu=Mt(0xc9d0da,0.95,0.28),
    plastic=Mt(0x1b212c,0.1,0.6), cast=Mt(0x7d8490,0.8,0.45), friction=Mt(0x6b4a2a,0.1,0.8), bronze=Mt(0xb98a3a,0.6,0.4);
function cyl(r,h,mat,axis,seg){var g=new T.CylinderGeometry(r,r,h,seg||28); if(axis==="x")g.rotateZ(Math.PI/2); if(axis==="z")g.rotateX(Math.PI/2); return new T.Mesh(g,mat)}
function box(x,y,z,mat){return new T.Mesh(new T.BoxGeometry(x,y,z),mat)}
var REG=[], EXL=[];
function reg(id,obj){obj.traverse(function(o){if(o.isMesh){o.material=o.material.clone();o.userData.part=id;o.castShadow=true;REG.push(o)}});return obj}
function shadow(obj){obj.traverse(function(o){if(o.isMesh)o.castShadow=true});return obj}
function ex(obj,x,y,z){obj.userData.home=obj.position.clone();obj.userData.ex=new V3(x,y,z);EXL.push(obj);return obj}
function glow(mesh,hex,i){mesh.traverse(function(o){if(o.isMesh)o.userData.glow={c:new T.Color(hex),i:i||0}});return mesh}
function setGlow(obj,i,hex){obj.traverse(function(o){if(o.isMesh&&o.userData.glow){o.userData.glow.i=i;if(hex!==undefined)o.userData.glow.c.setHex(hex)}})}

var car=new T.Group(); scene.add(car);

/* body: sections along the length of the car, joined to make one skin.
   Dimensions near the first XC90: length 4.80 m, width 1.90 m, height 1.78 m, wheelbase 2.86 m. */
var shell=new T.Group(), SHELLM=[];
(function(){
  function sq(v){return v*v}
  function sm(a,b,v){var t=clamp((v-a)/(b-a),0,1);return t*t*(3-2*t)}
  var ZF=3.82, ZR=-0.98, DZ=0.04, ZS=[]; for(var zz=ZF;zz>=ZR-0.0001;zz-=DZ)ZS.push(+zz.toFixed(3)); if(ZS[ZS.length-1]>ZR+0.001)ZS.push(ZR);
  var TK=[[3.82,0.92],[3.74,0.98],[3.5,1.03],[2.9,1.07],[2.3,1.1],[2.18,1.14],[1.42,1.69],[1.12,1.735],[0.1,1.75],[-0.5,1.735],[-0.66,1.7],[-0.72,1.62],[-0.88,1.2],[-0.93,1.12],[-0.98,1.08]];
  function topRaw(z){z=clamp(z,ZR,ZF);for(var i=0;i<TK.length-1;i++){var a=TK[i],b=TK[i+1];if(z<=a[0]&&z>=b[0])return a[1]+(b[1]-a[1])*(a[0]-z)/(a[0]-b[0])}return 1.05}
  function top(z){return(topRaw(z-0.05)+2*topRaw(z)+topRaw(z+0.05))/4}
  function belt(z){return 1.05+0.05*sm(2.2,-0.8,z)}
  function yLow(z){var y=0.30; if(z>3.2)y+=0.14*sq((z-3.2)/0.62); if(z<-0.55)y+=0.16*sq((-0.55-z)/0.43);
    [0,FA].forEach(function(za){var d=z-za; if(Math.abs(d)<0.44)y=Math.max(y,0.37+Math.sqrt(0.1936-d*d))}); return y}
  function halfW(z){var W=0.945, rf=0.4, rr=0.2;
    if(z>ZF-rf){var d=z-(ZF-rf); W-=rf-Math.sqrt(Math.max(0,rf*rf-d*d)); W=Math.max(W,0.55)}
    if(z<ZR+rr){var d2=(ZR+rr)-z; W-=(rr-Math.sqrt(Math.max(0,rr*rr-d2*d2)))*0.5}
    return W}
  function flare(z,y){var f=0; [0,FA].forEach(function(za){var d=Math.abs(z-za); f=Math.max(f,1-sm(0.42,0.66,d))}); return 0.03*f*(1-sm(0.82,1.0,y))*sm(0.3,0.5,y)}
  var NH=20, RN=2*NH+1, pos=[], rings=[];
  ZS.forEach(function(z){
    var W=halfW(z), yt=top(z), yl=yLow(z), yb=Math.min(belt(z),yt-0.035), ysh=yb-0.12;
    var g=clamp((yt-yb-0.05)/0.5,0,1), Wb=W-0.03, Wr=Wb-0.15*g, rr=0.03+0.06*g;
    var de=Math.min(z-ZR,ZF-z), re=0.06, k=de<re?(1-Math.sqrt(1-sq(1-de/re)))*0.06:0, ym=(yl+yt)/2;
    var half=[], x, y, t;
    for(var j=0;j<=NH;j++){
      if(j<=5){t=j/5; y=yl+(ysh-yl)*t; x=W-0.07*sq(1-t)+flare(z,y)}
      else if(j<=8){t=(j-5)/3; y=ysh+(yb-ysh)*t; x=W-0.03*t*t+flare(z,y)}
      else if(j<=14){t=(j-8)/6; y=yb+(yt-rr-yb)*t; x=Wb-(Wb-Wr)*t}
      else{var a=(j-14)/6*Math.PI/2; x=Wr*Math.cos(a); y=yt-rr+rr*Math.sin(a)}
      if(k>0){x=Math.max(0,x-k); y=y>ym?y-k*(y-ym)/Math.max(yt-ym,0.01):y+k*(ym-y)/Math.max(ym-yl,0.01)}
      half.push([x,y]);
    }
    var ring=[];
    for(var i=0;i<RN;i++){var jj=i<=NH?i:2*NH-i, hh=half[jj], px=i<=NH?hh[0]:-hh[0]; pos.push(px,hh[1],z); ring.push([px,hh[1],z])}
    rings.push(ring);
  });
  var posAttr=new T.Float32BufferAttribute(pos,3);
  function idx(z){return clamp(Math.round((ZF-z)/DZ),0,ZS.length-1)}
  function grid(s0,s1,i0,i1){var ix=[]; for(var s=s0;s<s1;s++)for(var i=i0;i<i1;i++){var a=s*RN+i,b=(s+1)*RN+i,c=a+1,d=b+1; ix.push(a,b,c,b,d,c)} return ix}
  var full=new T.BufferGeometry(); full.setAttribute("position",posAttr); full.setIndex(grid(0,ZS.length-1,0,RN-1)); full.computeVertexNormals();
  var paint=new T.MeshPhysicalMaterial({color:0xa9b0b9,metalness:0.85,roughness:0.32,clearcoat:1,clearcoatRoughness:0.08,side:T.DoubleSide,transparent:true,envMapIntensity:1.0});
  var body=new T.Mesh(full,paint); body.castShadow=true; body.renderOrder=3; shell.add(body); SHELLM.push([paint,1,0.14]);
  function cap(ring){var p=[], cx=0, cy=0; ring.forEach(function(v){cx+=v[0];cy+=v[1]}); cx/=ring.length; cy/=ring.length;
    for(var i=0;i<ring.length;i++){var n=(i+1)%ring.length; p.push(cx,cy,ring[i][2],ring[i][0],ring[i][1],ring[i][2],ring[n][0],ring[n][1],ring[n][2])}
    var g=new T.BufferGeometry(); g.setAttribute("position",new T.Float32BufferAttribute(p,3)); g.computeVertexNormals();
    var m=new T.Mesh(g,paint); m.renderOrder=3; shell.add(m)}
  cap(rings[0]); cap(rings[rings.length-1]);
  var mats=[];
  function patch(range,j0,j1,mat,across,xr){
    var ix=[], js=[]; if(across)js=[j0]; else for(var j=j0;j<j1;j++)js.push(j);
    js.forEach(function(j){var zr=range(j); if(!zr)return; var s0=idx(zr[0]), s1=idx(zr[1]);
      for(var s=s0;s<s1;s++){var cols=across?[]:[j,2*NH-j-1]; if(across)for(var c=j;c<2*NH-j;c++)cols.push(c);
        cols.forEach(function(i){var a=s*RN+i,b=(s+1)*RN+i; ix.push(a,b,a+1,b,b+1,a+1)})}});
    var g=new T.BufferGeometry(); g.setAttribute("position",posAttr); g.setAttribute("normal",full.getAttribute("normal")); g.setIndex(ix);
    mat.polygonOffset=true; mat.polygonOffsetFactor=-2; mat.polygonOffsetUnits=-2; mat.side=T.DoubleSide; mat.transparent=true;
    var m=new T.Mesh(g,mat); m.renderOrder=4; shell.add(m); if(mats.indexOf(mat)<0){mats.push(mat);SHELLM.push([mat,1,xr])}
  }
  function R(a,b){return function(){return[a,b]}}
  var glass=new T.MeshStandardMaterial({color:0x05070c,metalness:0.9,roughness:0.05,envMapIntensity:1.4});
  var trim=new T.MeshStandardMaterial({color:0x3a3f47,metalness:0.2,roughness:0.7});
  var red=new T.MeshStandardMaterial({color:0x3a0504,emissive:0x8c0b07,emissiveIntensity:0.5,roughness:0.15,metalness:0.4});
  var lamp=new T.MeshStandardMaterial({color:0xd5dbe5,emissive:0xc8d6ff,emissiveIntensity:0.3,roughness:0.12,metalness:0.7});
  /* grey lower sills and bumpers, side windows, windscreen, rear window, tall rear lamps, head lamps */
  patch(R(ZF,ZR),0,1,trim,false,0.2);
  patch(R(ZF,3.42),1,4,trim,false,0.2); patch(R(-0.7,ZR),1,4,trim,false,0.2);
  patch(function(j){return[2.08-(j-9)*0.15,0.64]},9,13,glass,false,0.1);
  patch(R(0.54,-0.26),9,13,glass,false,0.1);
  patch(function(j){return[-0.36,-0.74+(j-9)*0.045]},9,13,glass,false,0.1);
  patch(R(2.2,1.46),11,0,glass,true,0.1);
  patch(R(-0.73,-0.9),11,0,glass,true,0.1);
  patch(R(-0.84,ZR),6,13,red,false,0.5);
  patch(R(ZF,3.6),5,8,lamp,false,0.45);
  function add(m,x,y,z,rx){m.position.set(x,y,z); if(rx)m.rotation.x=rx; shell.add(m); return m}
  [1,-1].forEach(function(sd){
    var mr=add(box(0.2,0.12,0.08,paint),sd*1.01,1.15,2.0); mr.rotation.y=sd*0.25;
    [1.2,0.05].forEach(function(z){add(box(0.015,0.03,0.17,trim),sd*0.955,0.98,z)});
    var rail=add(box(0.035,0.04,1.9,trim),sd*0.62,1.735,0.35); rail.rotation.x=0.01;
    add(box(0.34,0.09,0.03,lamp),sd*0.52,0.84,ZF+0.003);
  });
  [0,FA].forEach(function(za){[1,-1].forEach(function(sd){
    var lg=new T.CylinderGeometry(0.43,0.43,0.3,32,1,true,-Math.PI/2,Math.PI); lg.rotateZ(Math.PI/2);
    var ln=new T.Mesh(lg,trim); ln.position.set(sd*0.79,0.37,za); shell.add(ln)})});
  add(box(1.3,0.05,0.25,paint),0,1.72,-0.66);
  add(box(0.52,0.12,0.012,new T.MeshStandardMaterial({color:0xdfe3ea,roughness:0.5})),0,0.86,ZR-0.008);
  /* front: a generic grille and lower intake, no marks */
  add(box(0.62,0.2,0.03,new T.MeshStandardMaterial({color:0x111418,metalness:0.5,roughness:0.4})),0,0.8,ZF+0.004);
  add(box(1.1,0.13,0.04,trim),0,0.52,ZF+0.005);
})();
car.add(shell); ex(shell,0,1.35,0);

/* ---------- powertrain: engine and gearbox. It rocks a little on its mounts with the torque. ---------- */
var pt=new T.Group(); pt.position.set(0,CRY,CRZ); car.add(pt);
function at(obj,x,y,z){obj.position.set(x,y-CRY,z-CRZ); pt.add(obj); return obj}
var SP={};  /* spinning groups: rotation around the x axis */
function spinner(id,x,build){var g=new T.Group(), s=new T.Group(); g.add(s); build(s); at(g,x,CRY,CRZ); SP[id]=s; return g}

/* engine */
var engine=new T.Group(), eng5=new T.Group(), eng6=new T.Group(), pulley;
(function(){
  function blk(grp,w,cyls){
    var b=box(w,0.4,0.38,cast); b.position.set(0,0.05,0.02); grp.add(b);
    var hd=box(w*0.96,0.12,0.3,Mt(0x9aa1ab,0.85,0.35)); hd.position.set(0,0.3,0.0); grp.add(hd);
    var cv=box(w*0.9,0.05,0.22,Mt(0x1e232b,0.4,0.4)); cv.position.set(0,0.385,-0.01); grp.add(cv);
    for(var i=0;i<cyls;i++){var c=cyl(0.018,0.05,rubber); c.position.set(-w/2+w*(i+0.5)/cyls,0.42,-0.01); grp.add(c)}
    var im=box(w*0.8,0.14,0.08,plastic); im.position.set(0,0.24,-0.22); grp.add(im);
    var exm=box(w*0.8,0.08,0.06,Mt(0x5a4a3c,0.6,0.6)); exm.position.set(0,0.14,0.23); grp.add(exm);
    var sump=box(w*0.85,0.1,0.3,cast); sump.position.set(0,-0.19,0.02); grp.add(sump);
  }
  blk(eng5,0.62,5); blk(eng6,0.74,6); eng6.position.x=-0.06;
  engine.add(eng5); engine.add(eng6);
  pulley=new T.Group(); var pd=cyl(0.075,0.03,steel,"x"); pulley.add(pd); var mk=box(0.032,0.02,0.02,Mt(0xf0b84a,0.2,0.5)); mk.position.set(0.0,0.06,0); pulley.add(mk);
  var pg=new T.Group(); pg.add(pulley); pg.position.set(-0.52,0,0); engine.add(pg); engine.userData.pg=pg;
  at(engine,-0.15,CRY,CRZ); reg("engine",engine); ex(engine,-0.45,0.5,0.25);
})();

/* gearbox case: bell housing, main case and the case around the differential */
var caseG=new T.Group(), CASEM=[];
(function(){
  var cm=new T.MeshStandardMaterial({color:0xb9c0c9,metalness:0.8,roughness:0.42,transparent:true,opacity:0.22,depthWrite:false,side:T.DoubleSide,envMapIntensity:0.8});
  CASEM.push(cm);
  var bg=new T.CylinderGeometry(0.17,0.2,0.18,36,1,true); bg.rotateZ(Math.PI/2); var bell=new T.Mesh(bg,cm); bell.position.set(0.26,0,0); caseG.add(bell);
  var mg=new T.CylinderGeometry(0.145,0.15,0.32,36,1,true); mg.rotateZ(Math.PI/2); var main=new T.Mesh(mg,cm); main.position.set(0.51,0,0); caseG.add(main);
  var endc=cyl(0.145,0.012,cm,"x",36); endc.position.set(0.672,0,0); caseG.add(endc);
  var dc=box(0.36,0.24,0.3,cm); dc.position.set(0.19,0.37-CRY+0.02,FA-CRZ+0.03); caseG.add(dc);
  at(caseG,0,CRY,CRZ); caseG.traverse(function(o){if(o.isMesh)o.userData.part="plan"}); ex(caseG,0.1,0.55,0);
  caseG.traverse(function(o){if(o.isMesh){o.renderOrder=6;REG.push(o)}});
})();

/* internal elements along the gearbox axis */
var EL={};
function lathe(pts,mat){var g=new T.LatheGeometry(pts.map(function(p){return new T.Vector2(p[0],p[1])}),40); g.rotateZ(-Math.PI/2); return new T.Mesh(g,mat)}
(function(){
  /* torque converter: impeller (engine side) and turbine (gearbox side) */
  var imp=Mt(0x8e98a6,0.9,0.32), tur=Mt(0x6f8fb3,0.85,0.35);
  EL.imp=spinner("imp",0.235,function(s){s.add(lathe([[0.04,-0.04],[0.12,-0.035],[0.138,0],[0.125,0.012],[0.04,0.012]],imp)); for(var i=0;i<6;i++){var r=box(0.006,0.04,0.012,Mt(0xf0b84a,0.3,0.5)); var a=i*Math.PI/3; r.position.set(-0.02,Math.cos(a)*0.1,Math.sin(a)*0.1); r.rotation.x=a; s.add(r)}});
  EL.tur=spinner("tur",0.275,function(s){s.add(lathe([[0.04,-0.012],[0.125,-0.012],[0.138,0],[0.12,0.035],[0.04,0.04]],tur)); for(var i=0;i<6;i++){var r=box(0.006,0.04,0.012,Mt(0xe7edf6,0.3,0.5)); var a=i*Math.PI/3+0.5; r.position.set(0.02,Math.cos(a)*0.1,Math.sin(a)*0.1); r.rotation.x=a; s.add(r)}});
  reg("conv",EL.imp); reg("conv",EL.tur); ex(EL.imp,-0.02,0.5,0); ex(EL.tur,0.04,0.5,0);
  /* input shaft through the box */
  EL.shaft=spinner("shaft",0.47,function(s){s.add(cyl(0.014,0.42,steel,"x",12))}); ex(EL.shaft,0.3,0.5,0); reg("plan",EL.shaft);
  /* oil pump */
  EL.pump=spinner("pump",0.335,function(s){s.add(cyl(0.11,0.022,cast,"x",36)); for(var i=0;i<5;i++){var t=box(0.024,0.02,0.02,steel); var a=i*Math.PI*2/5; t.position.set(0,Math.cos(a)*0.05,Math.sin(a)*0.05); s.add(t)}});
  reg("pump",EL.pump); ex(EL.pump,0.08,0.5,0);
  /* forward clutch: drum (input side) and hub with the plates (gear side) */
  var drumG=new T.CylinderGeometry(0.105,0.105,0.055,36,1,true); drumG.rotateZ(Math.PI/2);
  EL.c1d=spinner("c1d",0.385,function(s){s.add(new T.Mesh(drumG,Mt(0x9aa3b2,0.9,0.3))); var bk=cyl(0.105,0.006,Mt(0x9aa3b2,0.9,0.3),"x",36); bk.position.x=-0.027; s.add(bk); for(var i=0;i<3;i++){var p=cyl(0.1,0.004,steel,"x",36); p.position.x=-0.016+i*0.016; s.add(p)}});
  EL.c1h=spinner("c1h",0.385,function(s){for(var i=0;i<3;i++){var p=cyl(0.095,0.006,friction,"x",36); p.position.x=-0.008+i*0.016; s.add(p)} s.add(cyl(0.045,0.05,steel,"x",24)); var mk=box(0.01,0.02,0.02,Mt(0xe7edf6,0.3,0.5)); mk.position.set(0.026,0.08,0); s.add(mk)});
  reg("fwd",EL.c1d); reg("fwd",EL.c1h); ex(EL.c1d,0.17,0.5,0); ex(EL.c1h,0.2,0.5,0);
  glow(EL.c1h,0xff6a4d,0); glow(EL.c1d,0xf0b84a,0);
  /* reverse elements (aw: C2 pack) */
  EL.c2=spinner("c2",0.44,function(s){var d=new T.CylinderGeometry(0.098,0.098,0.04,36,1,true); d.rotateZ(Math.PI/2); s.add(new T.Mesh(d,Mt(0x9aa3b2,0.9,0.3))); for(var i=0;i<3;i++){var p=cyl(0.09,0.005,i%2?steel:friction,"x",36); p.position.x=-0.012+i*0.012; s.add(p)}});
  reg("rev",EL.c2); ex(EL.c2,0.27,0.5,0); glow(EL.c2,0xf0b84a,0);
  /* C3 (aw only) */
  EL.c3=spinner("c3",0.49,function(s){var d=new T.CylinderGeometry(0.092,0.092,0.034,36,1,true); d.rotateZ(Math.PI/2); s.add(new T.Mesh(d,Mt(0x9aa3b2,0.9,0.3))); s.add(cyl(0.085,0.006,friction,"x",36))});
  reg("plan",EL.c3); ex(EL.c3,0.36,0.5,0);
  /* planetary sets */
  function planet(id,x){return spinner(id,x,function(s){
    var rg=new T.TorusGeometry(0.088,0.012,10,40); rg.rotateY(Math.PI/2); s.add(new T.Mesh(rg,steel));
    s.add(cyl(0.028,0.03,alu,"x",16));
    for(var i=0;i<3;i++){var a=i*Math.PI*2/3, p=cyl(0.026,0.026,bronze,"x",16); p.position.set(0,Math.cos(a)*0.058,Math.sin(a)*0.058); s.add(p)}
  })}
  EL.p1=planet("p1",0.53); EL.p2=planet("p2",0.57); EL.p3=planet("p3",0.61);
  [EL.p1,EL.p2,EL.p3].forEach(function(p,i){reg("plan",p); ex(p,0.45+i*0.08,0.5,0)});
  /* B3 brake (aw) on the case, does not turn */
  var b3=new T.Group(); for(var i=0;i<3;i++){var r=new T.Mesh(new T.TorusGeometry(0.118,0.006,6,40),i%2?steel:friction); r.rotation.y=Math.PI/2; r.position.x=-0.01+i*0.01; b3.add(r)}
  EL.b3=at(b3,0.645,CRY,CRZ); reg("rev",EL.b3); ex(EL.b3,0.72,0.5,0); glow(EL.b3,0xf0b84a,0);
  /* one-way clutch: an inner race with sprags */
  EL.owc=spinner("owc",0.655,function(s){s.add(cyl(0.06,0.018,steel,"x",28)); for(var i=0;i<10;i++){var a=i*Math.PI/5, q=box(0.016,0.016,0.008,Mt(0xd8dde6,0.8,0.3)); q.position.set(0,Math.cos(a)*0.068,Math.sin(a)*0.068); q.rotation.x=a+0.6; s.add(q)}});
  reg("owc",EL.owc); ex(EL.owc,0.82,0.5,0); glow(EL.owc,0xff6a4d,0);
  /* gm: forward band and reverse band, thin bands around drums */
  function band(x,id){var g=new T.Group(); var t=new T.Mesh(new T.TorusGeometry(0.1,0.009,8,40,Math.PI*1.85),Mt(0x6b4a2a,0.2,0.7)); t.rotation.y=Math.PI/2; g.add(t);
    var dr=new T.CylinderGeometry(0.09,0.09,0.03,32,1,true); dr.rotateZ(Math.PI/2); g.add(new T.Mesh(dr,steel)); return at(g,x,CRY,CRZ)}
  EL.fband=band(0.57,"fband"); reg("fwd",EL.fband); ex(EL.fband,0.52,0.5,0); glow(EL.fband,0xff6a4d,0);
  EL.rband=band(0.44,"rband"); reg("rev",EL.rband); ex(EL.rband,0.27,0.5,0); glow(EL.rband,0xf0b84a,0);
  /* output gear down to the differential */
  EL.outg=new T.Group(); var og=new T.Group(); og.add(cyl(0.07,0.03,steel,"x",30)); for(var k=0;k<16;k++){var tth=box(0.032,0.012,0.012,steel); var a=k*Math.PI/8; tth.position.set(0,Math.cos(a)*0.074,Math.sin(a)*0.074); tth.rotation.x=a; og.add(tth)}
  EL.outg.add(og); SP.outg=og; at(EL.outg,0.43,0.49,2.93); reg("plan",EL.outg); ex(EL.outg,0.2,0.1,0);
})();

/* valve body, solenoids, ATF pan, TCM */
var vbG=new T.Group(), sols=[], pan=new T.Group(), atfLevel, atfMat, tcm=new T.Group(), tcmLed;
(function(){
  var b=box(0.3,0.05,0.16,alu); vbG.add(b);
  for(var i=0;i<5;i++){var s=cyl(0.014,0.05,Mt(0x2a3a52,0.3,0.5),"z",14); s.position.set(-0.12+i*0.06,-0.005,0.1); vbG.add(s); sols.push(s); glow(s,0x69cfe6,0)}
  at(vbG,0.5,0.445,3.02); reg("vb",vbG); ex(vbG,0.15,-0.22,0.25);
  var pm=new T.MeshStandardMaterial({color:0x8d949e,metalness:0.8,roughness:0.4,transparent:true,opacity:0.45,depthWrite:false});
  var pb=box(0.32,0.055,0.2,pm); pan.add(pb);
  atfMat=new T.MeshStandardMaterial({color:0xb5161e,roughness:0.2,metalness:0,transparent:true,opacity:0.85,emissive:0x400004,emissiveIntensity:0.6});
  atfLevel=box(0.3,0.04,0.18,atfMat); atfLevel.position.y=-0.005; pan.add(atfLevel);
  at(pan,0.5,0.39,3.02); reg("atf",pan); ex(pan,0.15,-0.36,0.25); atfMat=atfLevel.material;
  var tb=box(0.12,0.04,0.1,Mt(0x20262f,0.3,0.5)); tcm.add(tb);
  tcmLed=new T.Mesh(new T.SphereGeometry(0.008,10,8),new T.MeshBasicMaterial({color:0x173040})); tcmLed.position.set(0.04,0.024,0.03); tcm.add(tcmLed);
  at(tcm,0.5,0.8,2.95); reg("tcm",tcm); ex(tcm,0.1,0.75,0);
})();

/* selector lever in the cabin, the cable, and the lever on the gearbox */
var selector=new T.Group(), boxLever, stick;
(function(){
  var base=box(0.1,0.04,0.2,plastic); selector.add(base);
  stick=new T.Group(); var st=cyl(0.008,0.16,steel); st.position.y=0.08; stick.add(st); var kn=new T.Mesh(new T.SphereGeometry(0.022,14,10),Mt(0x2a2f38,0.3,0.5)); kn.position.y=0.17; stick.add(kn);
  selector.add(stick); selector.position.set(0.12,0.84,1.6); car.add(reg("cable",selector)); ex(selector,0,0.4,0);
  var c=new T.CatmullRomCurve3([new V3(0.12,0.8,1.66),new V3(0.16,0.5,1.85),new V3(0.38,0.42,2.4),new V3(0.62,0.52,2.78),new V3(0.68,0.58,2.86)]);
  var cm=new T.Mesh(new T.TubeGeometry(c,50,0.006,8),Mt(0x161a20,0.1,0.7)); car.add(reg("cable",cm)); ex(cm,0,0.2,0);
  boxLever=new T.Group(); var ar=box(0.012,0.08,0.02,steel); ar.position.y=-0.035; boxLever.add(ar);
  boxLever.position.set(0.69,0.6-CRY,2.86-CRZ); pt.add(boxLever); reg("cable",boxLever); ex(boxLever,0.4,0.3,0);
})();

/* radiator with the ATF cooler, and the two cooler lines with ATF dots */
var rad=new T.Group(), coolerTank, coolerCurves=[], atfDots=[];
(function(){
  var core=box(1.3,0.44,0.05,Mt(0x3a414c,0.6,0.6)); rad.add(core);
  coolerTank=box(0.08,0.46,0.07,Mt(0x2a2f38,0.4,0.5)); coolerTank.position.set(0.66,0,0); rad.add(coolerTank);
  rad.position.set(0,0.62,3.62); car.add(rad); reg("cooler",rad); ex(rad,0,0.15,0.4);
  var a=[[0.62,0.5,3.1],[0.7,0.5,3.35],[0.66,0.5,3.58]], b=[[0.58,0.56,3.1],[0.67,0.6,3.36],[0.66,0.66,3.58]];
  [a,b].forEach(function(pts){var c=new T.CatmullRomCurve3(pts.map(function(p){return new V3(p[0],p[1],p[2])}));coolerCurves.push(c);
    var m=new T.Mesh(new T.TubeGeometry(c,30,0.008,8),Mt(0x9aa3b2,0.8,0.4)); car.add(reg("cooler",m)); ex(m,0,0.08,0.2)});
  var dm=new T.MeshBasicMaterial({color:0xff4d5a});
  for(var i=0;i<12;i++){var d=new T.Mesh(new T.SphereGeometry(0.011,8,6),dm); car.add(d); atfDots.push(d)}
})();

/* differential, angle gear, drive shafts, propeller shaft, Haldex, rear final drive */
var diffG=new T.Group(), angleG=new T.Group(), awdParts=[], shafts={};
(function(){
  var ring=new T.Group(); var rg=cyl(0.12,0.025,bronze,"x",40); ring.add(rg); for(var k=0;k<20;k++){var t=box(0.03,0.014,0.014,bronze); var a=k*Math.PI/10; t.position.set(0,Math.cos(a)*0.125,Math.sin(a)*0.125); t.rotation.x=a; ring.add(t)}
  var carrier=new T.Mesh(new T.SphereGeometry(0.065,20,14),cast); carrier.position.x=-0.06; ring.add(carrier);
  diffG.add(ring); SP.diff=ring; diffG.position.set(0.24,0.37,FA); car.add(reg("diff",diffG)); ex(diffG,0.1,-0.15,-0.1);
  /* angle gear on the right side of the gearbox, and the splined sleeve */
  var hous=cyl(0.09,0.14,cast,"x",30); angleG.add(hous);
  var nose=cyl(0.05,0.18,cast,"z",24); nose.position.set(-0.01,-0.02,-0.12); angleG.add(nose);
  var sl=cyl(0.05,0.03,steel,"x",24); sl.position.x=0.09; angleG.add(sl);
  angleG.position.set(0.04,0.37,FA); car.add(reg("angle",angleG)); ex(angleG,-0.1,-0.2,-0.3); awdParts.push(angleG);
  function sh(id,part,len,r,axis){var g=new T.Group(), s=new T.Group(); g.add(s); s.add(cyl(r,len,steel,axis,14));
    if(axis==="x"){[-1,1].forEach(function(e){var b=new T.Mesh(new T.SphereGeometry(r*2.6,14,10),rubber); b.scale.set(1.5,1,1); b.position.x=e*len/2; s.add(b)})}
    var mk=box(axis==="x"?0.03:0.012,0.012,axis==="x"?0.012:0.03,Mt(0xf0b84a,0.3,0.5)); mk.position.set(0,r+0.004,0); s.add(mk);
    reg(part,g); shafts[id]={g:g,s:s}; return g}
  var L=sh("L","shafts",0.36,0.018,"x"); L.position.set(0.55,0.37,FA); car.add(L); ex(L,0.25,-0.1,0);
  var I=sh("I","shafts",0.42,0.02,"x"); I.position.set(-0.17,0.37,FA); car.add(I); ex(I,-0.1,-0.25,0);
  var brg=box(0.04,0.08,0.06,cast); brg.position.set(-0.4,0.39,FA); car.add(reg("shafts",brg)); ex(brg,-0.1,-0.25,0);
  var Rr=sh("R","shafts",0.32,0.018,"x"); Rr.position.set(-0.57,0.37,FA); car.add(Rr); ex(Rr,-0.25,-0.1,0);
  var P1=sh("P1","haldex",1.12,0.03,"z"); P1.position.set(0.02,0.31,2.1); car.add(P1); ex(P1,0,-0.25,0); awdParts.push(P1);
  var P2=sh("P2","haldex",1.12,0.03,"z"); P2.position.set(0.02,0.31,0.92); car.add(P2); ex(P2,0,-0.25,0); awdParts.push(P2);
  var cb=box(0.1,0.06,0.06,rubber); cb.position.set(0.02,0.33,1.5); car.add(reg("haldex",cb)); ex(cb,0,-0.25,0); awdParts.push(cb);
  var hx=cyl(0.085,0.18,alu,"z",28); hx.position.set(0.0,0.37,0.27); car.add(reg("haldex",hx)); ex(hx,0,-0.15,0.15); awdParts.push(hx);
  var rd=new T.Mesh(new T.SphereGeometry(0.12,24,16),cast); rd.scale.set(1,0.9,1.1); rd.position.set(0,0.37,0.03); car.add(reg("haldex",rd)); ex(rd,0,-0.15,0); awdParts.push(rd);
  var RL=sh("RL","haldex",0.6,0.018,"x"); RL.position.set(0.42,0.37,0); car.add(RL); ex(RL,0.2,-0.1,0); awdParts.push(RL);
  var RR=sh("RR","haldex",0.6,0.018,"x"); RR.position.set(-0.42,0.37,0); car.add(RR); ex(RR,-0.2,-0.1,0); awdParts.push(RR);
  glow(shafts.L.g,0xf0b84a,0); glow(shafts.I.g,0xf0b84a,0); glow(shafts.R.g,0xf0b84a,0); glow(shafts.P1.g,0xf0b84a,0); glow(shafts.P2.g,0xf0b84a,0); glow(shafts.RL.g,0xf0b84a,0); glow(shafts.RR.g,0xf0b84a,0);
  glow(diffG,0xf0b84a,0); glow(angleG,0xf0b84a,0);
  /* simple floor pan so the drive line has a reference */
  var floor=box(1.5,0.02,3.2,Mt(0x161c26,0.3,0.8)); floor.position.set(0,0.47,0.95); floor.receiveShadow=true; car.add(floor); ex(floor,0,1.3,0); shell.userData.floor=floor;
})();

/* wheels: in the scene, not in the car, so the car can flex forward on its tyres */
function wheel(sd,z){
  var g=new T.Group();
  var pts=[[0.24,-0.12],[0.335,-0.128],[0.365,-0.105],[0.372,-0.065],[0.372,0.065],[0.365,0.105],[0.335,0.128],[0.24,0.12]].map(function(p){return new T.Vector2(p[0],p[1])});
  var tg=new T.LatheGeometry(pts,56); tg.rotateZ(Math.PI/2); g.add(new T.Mesh(tg,rubber));
  for(var i=-2;i<=2;i++){var gr=new T.Mesh(new T.TorusGeometry(0.3725,0.004,6,56),Mt(0x06070a,0,1)); gr.rotation.y=Math.PI/2; gr.position.x=i*0.042; g.add(gr)}
  var barrel=cyl(0.24,0.21,Mt(0x9aa3b2,0.95,0.3),"x",40); g.add(barrel);
  var face=cyl(0.06,0.03,alu,"x"); face.position.x=sd*0.11; g.add(face);
  for(var k=0;k<5;k++){var sp=box(0.02,0.19,0.05,alu); var a=k*Math.PI*2/5; sp.position.set(sd*0.108,Math.cos(a)*0.14,Math.sin(a)*0.14); sp.rotation.x=a; g.add(sp)}
  var disc=cyl(0.16,0.022,Mt(0x8a8f98,0.9,0.45),"x",40); disc.position.x=-sd*0.12; g.add(disc);
  var spin=new T.Group(); while(g.children.length)spin.add(g.children[0]); g.add(spin);
  g.position.set(sd*0.8,0.37,z); scene.add(shadow(g)); ex(g,sd*0.45,0,0);
  var cal=box(0.05,0.12,0.09,Mt(0x8d2a22,0.4,0.5)); cal.position.set(sd*0.66,0.5,z+0.1); scene.add(reg("brakes",cal)); glow(cal,0xff6a4d,0);
  var hub=cyl(0.05,0.08,steel,"x",20); hub.position.set(sd*0.68,0.37,z); scene.add(hub);
  return {g:g,spin:spin,cal:cal,hub:hub};
}
var WH={rL:wheel(1,0),rR:wheel(-1,0),fL:wheel(1,FA),fR:wheel(-1,FA)};
var pbrake=[];
[1,-1].forEach(function(sd){var d=cyl(0.09,0.05,Mt(0x3a3f47,0.7,0.5),"x",24); d.position.set(sd*0.64,0.37,0); scene.add(reg("brakes",d)); glow(d,0xff6a4d,0); pbrake.push(d)});
var wheelParts=[WH.rL,WH.rR,WH.fL,WH.fR];

function setBody(mode){
  if(remote("body",mode))return;
  S.body=mode; shell.visible=mode<2;
  SHELLM.forEach(function(a){a[0].opacity=mode===0?a[2]:a[1]; a[0].depthWrite=mode===1});
  $("bBody").textContent=["X-ray","Paint","No body"][mode];
}
function gbVis(){
  var aw=S.gb==="aw";
  eng5.visible=aw; eng6.visible=!aw;
  EL.c2.visible=aw; EL.c3.visible=aw; EL.p3.visible=aw; EL.b3.visible=aw; EL.rband.visible=!aw; EL.fband.visible=!aw;
  awdParts.forEach(function(o){o.visible=S.awd});
}
window.__gbVis=gbVis; gbVis();

/* ---------- pose: every frame ---------- */
var VS=0.045, ANG={}, _c=new T.Color(), _v=new V3(), SELC=new T.Color(0x4f86ff), rockA=0;
function spinBy(id,w,dt){ANG[id]=(ANG[id]||0)+w*dt; return ANG[id]}
function pose(dt){
  var f=F, k=S.k, flow=S.flow;
  for(var i=0;i<EXL.length;i++){var o=EXL[i]; o.position.copy(o.userData.home).addScaledVector(o.userData.ex,k)}
  /* the car body flexes forward on the tyres when the car is held */
  car.position.z=PH.xe*0.7; car.rotation.x=-PH.xe*0.12;
  /* the engine rocks on its mounts with the torque reaction */
  var rk=clamp(-PH.te_*0.00018,-0.06,0.06); rockA+=(rk-rockA)*Math.min(1,dt*8); pt.rotation.x=reduce?0:rockA;
  var d=reduce?0:dt;
  var we=PH.we*VS, wt=Math.max(0,PH.wt)*VS, G=f.G||0, wo=G?PH.v*G/RW*VS:0;
  var owcSlip=f.slipAt==="owc", clSlip=f.slipAt==="clutch"&&f.box!=="R", rvSlip=f.slipAt==="clutch"&&f.box==="R";
  engine.userData.pg.rotation.x=spinBy("eng",we,d);
  SP.imp.rotation.x=spinBy("imp",we,d); SP.pump.rotation.x=spinBy("pump",we,d);
  SP.tur.rotation.x=spinBy("tur",wt,d); SP.shaft.rotation.x=SP.tur.rotation.x; SP.c1d.rotation.x=SP.tur.rotation.x;
  var fwdApplied=(f.box==="D"||f.box==="M1")&&f.pc>0.3;
  var hubW=fwdApplied&&!clSlip?wt:(f.box==="D"||f.box==="M1"?wo:0);
  if(f.box==="R")hubW=-wo*0.4;
  SP.c1h.rotation.x=spinBy("c1h",hubW,d);
  SP.c2.rotation.x=spinBy("c2",f.box==="R"&&!rvSlip?wt:f.box==="R"?wt*0.6:wt*0.3,d);
  SP.c3.rotation.x=spinBy("c3",wo*0.8,d);
  var plW=owcSlip?wt*0.7:wo;
  SP.p1.rotation.x=spinBy("p1",plW,d); SP.p2.rotation.x=spinBy("p2",-plW*0.6,d); SP.p3.rotation.x=spinBy("p3",wo*0.5,d);
  SP.owc.rotation.x=spinBy("owc",owcSlip?-wt*0.5:0,d);
  SP.outg.rotation.x=spinBy("outg",-wo*0.6,d);
  var ww=PH.v/RW;
  SP.diff.rotation.x=spinBy("diff",(PH.carrier),d);
  shafts.L.s.rotation.x=spinBy("L",ww,d); shafts.I.s.rotation.x=spinBy("I",PH.free,d); shafts.R.s.rotation.x=spinBy("R",f.slipAt==="diff"?0.0:ww,d);
  if(f.slipAt!=="diff")shafts.R.s.rotation.x=shafts.L.s.rotation.x;
  var prop=PH.carrier*2.6;
  shafts.P1.s.rotation.z=spinBy("P",prop,d); shafts.P2.s.rotation.z=shafts.P1.s.rotation.z;
  shafts.RL.s.rotation.x=spinBy("RL",ww,d); shafts.RR.s.rotation.x=shafts.RL.s.rotation.x;
  var wa=PH.x/RW; for(var w=0;w<4;w++)wheelParts[w].spin.rotation.x=wa;
  groundTex.offset.y=-(PH.x/4)%1; startLine.position.z=FA-PH.x;
  /* selector lever positions */
  var SI={P:0,R:1,N:2,D:3,M1:3}; stick.rotation.x=(SI[S.sel]-1.5)*0.18; stick.rotation.z=S.sel==="M1"?-0.25:0;
  boxLever.rotation.x=(SI[f.box]-1.5)*0.3;
  /* glow: amber where torque goes, red where it slips, blue on the selected part */
  var tq=clamp(Math.abs(PH.tcl)/250,0,1), on=flow?1:0;
  setGlow(EL.c1d,fwdApplied?0.25+0.5*tq*on:0);
  setGlow(EL.c1h,clSlip?clamp(0.35+PH.heat/120,0,1.4)*(0.75+0.25*Math.sin(S.t*14)):fwdApplied?0:0,clSlip?0xff6a4d:0xf0b84a);
  setGlow(EL.fband,clSlip?clamp(0.35+PH.heat/120,0,1.4):fwdApplied?0.3*on:0,clSlip?0xff6a4d:0xf0b84a);
  var revOn=f.box==="R"&&f.pc>0.3;
  setGlow(EL.c2,revOn?(rvSlip?1:0.5*on):0,rvSlip?0xff6a4d:0xf0b84a); setGlow(EL.b3,revOn||(f.box==="M1"&&f.pc>0.3)?(rvSlip?1:0.5*on):0,rvSlip?0xff6a4d:0xf0b84a); setGlow(EL.rband,revOn?(rvSlip?1:0.5*on):0,rvSlip?0xff6a4d:0xf0b84a);
  setGlow(EL.owc,owcSlip?0.8+0.3*Math.sin(S.t*14):0);
  var outT=f.drive&&!owcSlip&&Math.abs(PH.fd)>100?clamp(Math.abs(PH.fd)/9000,0.2,1)*on:0;
  setGlow(diffG,outT); setGlow(shafts.L.g,f.slipAt==="diff"?0:outT); setGlow(shafts.R.g,f.slipAt==="diff"?0:outT);
  setGlow(shafts.I.g,f.slipAt==="diff"?0.9+0.3*Math.sin(S.t*14):outT,f.slipAt==="diff"?0xff6a4d:0xf0b84a);
  var rear=S.awd&&(f.slipAt==="diff"?PH.hcap/HMAX:0.3)*outT;
  setGlow(angleG,S.awd?outT:0); setGlow(shafts.P1.g,rear); setGlow(shafts.P2.g,rear); setGlow(shafts.RL.g,rear); setGlow(shafts.RR.g,rear);
  var heldGlow=S.fault==="held"?(F.held?0.8+0.3*Math.sin(S.t*10):0.35):0;
  wheelParts.forEach(function(wp){setGlow(wp.cal,heldGlow+(f.brake?0.25:0))}); pbrake.forEach(function(p){setGlow(p,heldGlow)});
  sols.forEach(function(s,i){setGlow(s,S.engine&&PH.pl>0.5&&f.drive&&(i===(f.box==="R"?3:f.gear-1)||i===4)?0.9:0)});
  tcmLed.material.color.setHex(!S.engine?0x173040:(S.fault==="pressure"||S.fault==="lowatf")&&Math.sin(S.t*6)>0?0xff6a4d:0x2fbf71);
  /* ATF: level and colour */
  var lvl=S.fault==="lowatf"?0.35:1; atfLevel.scale.y=lvl; atfLevel.position.y=-0.025+0.02*lvl;
  atfMat.color.setHex(S.fault==="coolant"?0xe8a0b8:PH.heat>60||S.fault==="fwd"?0x5a1a10:0xb5161e);
  atfDots.forEach(function(dd,i){dd.visible=flow&&S.engine; if(!dd.visible)return;
    var c=coolerCurves[i%2], u=((i/12*2+S.t*(0.15+PH.we*RPM/9000))*(i%2?-1:1))%1; if(u<0)u+=1; c.getPoint(u,dd.position); dd.material.color.setHex(S.fault==="coolant"?0xf2b8cf:0xff4d5a)});
  var pulse=0.5+0.2*Math.sin(S.t*4);
  for(var j=0;j<REG.length;j++){
    var m=REG[j], e=m.material.emissive, g=m.userData.glow; if(!e)continue;
    if(g)e.copy(g.c).multiplyScalar(g.i); else e.setRGB(0,0,0);
    if(m.userData.part===S.part)e.add(_c.copy(SELC).multiplyScalar(g?pulse*0.35:pulse));
  }
  CASEM[0].opacity=S.body===1?0.85:0.22; CASEM[0].depthWrite=S.body===1;
}

/* ---------- power flow diagram ---------- */
var FL={t:0};
function drawFlow(dt){
  var c=$("flowInset"); if(!c||c.style.display==="none")return;
  var w=c.clientWidth, h=c.clientHeight; if(!w)return;
  var dpr=Math.min(window.devicePixelRatio||1,2);
  if(c.width!==Math.round(w*dpr)){c.width=Math.round(w*dpr);c.height=Math.round(h*dpr)}
  var g=c.getContext("2d"); g.setTransform(dpr*w/260,0,0,dpr*h/176,0,0); g.clearRect(0,0,260,176);
  FL.t+=reduce?0:dt;
  drawFlowTo(g,260,176,FL.t,9);
}
function drawFlowTo(g,W,H,t,fs){
  var f=F, sx=W/260, sy=H/176;
  function Bx(x,y,w,hh,title,val,st){
    var col=st==="slip"?"#ff6a4d":st==="tq"?"#f0b84a":st==="off"?"#33456a":st==="hold"?"#e7edf6":"#94a3bd";
    g.fillStyle=st==="slip"?"rgba(255,106,77,0.16)":st==="tq"?"rgba(240,184,74,0.12)":"rgba(18,29,51,0.9)";
    g.beginPath(); g.rect(x*sx,y*sy,w*sx,hh*sy); g.fill(); g.lineWidth=1.5*sx; g.strokeStyle=col; g.stroke();
    g.fillStyle=st==="off"?"#5a6a86":"#e7edf6"; g.font="600 "+fs*sx+"px IBM Plex Sans, system-ui, sans-serif"; g.textBaseline="top"; g.fillText(title,(x+4)*sx,(y+3)*sy);
    g.fillStyle=col; g.font="500 "+fs*sx+"px IBM Plex Mono, ui-monospace, monospace"; g.fillText(val,(x+4)*sx,(y+3+fs+2)*sy);
  }
  function link(x0,y0,x1,y1,speed,tq,slip){
    g.strokeStyle=slip?"#ff6a4d":tq>0.05?"rgba(240,184,74,"+(0.35+0.65*tq)+")":"#27364f"; g.lineWidth=(1.5+tq*2.5)*sx;
    g.beginPath(); g.moveTo(x0*sx,y0*sy); g.lineTo(x1*sx,y1*sy); g.stroke();
    if(speed>0.5&&!reduce){var n=3; g.fillStyle=tq>0.05?"#ffd27a":"#69cfe6"; for(var i=0;i<n;i++){var u=((i/n+t*Math.min(speed,3000)/1500)%1); g.beginPath(); g.arc((x0+(x1-x0)*u)*sx,(y0+(y1-y0)*u)*sy,2*sx,0,7); g.fill()}}
  }
  var tq=clamp(Math.abs(PH.tt)/300,0,1), tout=f.drive?clamp(Math.abs(PH.fd)/9000,0,1):0;
  var el=f.box==="R"?(S.gb==="aw"?"C2 + B3":"REV BAND"):(S.gb==="aw"?"C1":"FWD BAND");
  var clSt=!f.drive?"off":f.slipAt==="clutch"?"slip":f.slipAt==="owc"?"tq":f.pc>0.3?(tout>0.02?"tq":"hold"):"off";
  var clVal=!f.drive?"open":f.slipAt==="clutch"?"slips":f.pc>0.3?"holds":"fills";
  Bx(4,6,56,30,"ENGINE",rpm(f.rpmE)+"",S.engine?(tq>0.05?"tq":"hold"):"off");
  link(60,21,70,21,f.rpmE,tq,false);
  Bx(70,6,56,30,"CONVERTER","slip "+(f.rpmE>100?Math.round((1-f.rpmT/f.rpmE)*100):0)+"%",S.engine?"tq":"off");
  link(126,21,136,21,f.rpmT,tq*(f.drive?1:0.1),false);
  Bx(136,6,56,30,el,clVal,clSt);
  link(192,21,202,21,f.rpmO,tout,f.slipAt==="clutch");
  var gSt=f.slipAt==="owc"?"slip":f.drive?(tout>0.02?"tq":"hold"):f.box==="P"?"hold":"off";
  Bx(202,6,54,30,f.box==="P"?"PARK":f.box==="N"?"GEARS":f.box==="R"?"REVERSE":"GEAR "+f.gear,f.slipAt==="owc"?(S.gb==="aw"?"F2 free":"roller free"):f.box==="P"?"locked":rpm(f.rpmO)+"",gSt);
  link(229,36,229,60,f.rpmO,tout,f.slipAt==="owc");
  var dSt=f.slipAt==="diff"?"slip":tout>0.02?"tq":"hold";
  Bx(196,60,60,30,"DIFF",f.slipAt==="diff"?"R side free":Math.round(Math.abs(PH.carrier)*RPM)+"",dSt);
  link(196,75,150,75,Math.abs(PH.v/RW)*RPM,f.slipAt==="diff"?0:tout*0.6,false);
  var held=F.held&&(S.fault==="held"||F.brake);
  Bx(90,60,60,30,"FRONT",Math.abs(f.kmh).toFixed(1)+" km/h",held?"slip":S.fault==="shaft"&&f.drive?"hold":Math.abs(f.kmh)>0.2?"tq":"hold");
  if(S.awd){
    link(226,90,226,118,Math.abs(PH.carrier)*RPM*2.6,tout*0.5,false);
    Bx(196,118,60,30,"ANGLE GEAR",Math.round(Math.abs(PH.carrier)*RPM*2.6)+"",tout>0.02?"tq":"hold");
    link(196,133,150,133,Math.abs(PH.carrier)*RPM*2.6,f.slipAt==="diff"?PH.hcap/HMAX*tout:tout*0.3,false);
    var hx=S.fault==="shaft"&&f.drive, hSt=hx?(PH.hcap>200?"tq":"slip"):"hold";
    Bx(90,118,60,30,"HALDEX",hx?(PH.hcap>200?"closed":"closing"):"open",hSt);
    link(90,133,64,133,Math.abs(PH.v/RW)*RPM,hx?PH.hcap/HMAX*Math.max(tout,0.3):0,false);
    Bx(4,118,60,30,"REAR",Math.abs(f.kmh).toFixed(1)+" km/h",held?"slip":"hold");
  }else{
    g.fillStyle="#5a6a86"; g.font="500 "+fs*sx+"px IBM Plex Sans, system-ui, sans-serif"; g.fillText("FWD: no rear drive",120*sx,130*sy);
  }
  g.fillStyle="#94a3bd"; g.font="500 "+(fs-1)*sx+"px IBM Plex Mono, ui-monospace, monospace"; g.fillText("rpm",8*sx,48*sy);
  if(held){g.fillStyle="#ff6a4d"; g.font="600 "+fs*sx+"px IBM Plex Sans, system-ui, sans-serif"; g.fillText(S.fault==="held"?"HELD":"BRAKE",8*sx,64*sy); g.fillText(Math.abs(Math.round(PH.xe*100))+" cm flex",8*sx,(64+fs+3)*sy)}
}
function setFlow(on){if(remote("flow",on?1:0))return;S.flow=on;$("bFlow").setAttribute("aria-pressed",on?"true":"false");$("flowInset").style.display=on?"":"none"}
$("bFlow").addEventListener("click",function(){setFlow(!S.flow)});

/* picking: a tap selects a part, a drag turns the model */
var ray=new T.Raycaster(), down=null;
canvas.addEventListener("pointerdown",function(e){down={x:e.clientX,y:e.clientY,t:performance.now()};controls.autoRotate=false});
canvas.addEventListener("pointerup",function(e){
  if(!down)return; var moved=Math.hypot(e.clientX-down.x,e.clientY-down.y), dtm=performance.now()-down.t; down=null;
  if(moved>7||dtm>500)return;
  var r=canvas.getBoundingClientRect();
  ray.setFromCamera(new T.Vector2((e.clientX-r.left)/r.width*2-1,-((e.clientY-r.top)/r.height)*2+1),camera);
  var hit=ray.intersectObjects(REG.filter(visibleMesh),false);
  if(hit.length){var id=hit[0].object.userData.part; if(id==="plan"&&hit.length>1){for(var i=1;i<hit.length;i++){if(hit[i].object.userData.part!=="plan"){id=hit[i].object.userData.part;break}}}
    select(id); var pb=$("tabs").children[2]; if(pb.offsetParent)showTab("parts")}
});
function visibleMesh(o){var p=o; while(p){if(!p.visible)return false; p=p.parent} return true}

function explodeLabel(on){S.explode=on;$("bExplode").setAttribute("aria-pressed",on?"true":"false");$("bExplode").textContent=on?"Assemble":"Take apart"}
function setExplode(on){if(remote("explode",on?1:0))return;S.kt=on?1:0;explodeLabel(on)}
function toggleBody(){setBody((S.body+1)%3)}
$("bExplode").addEventListener("click",function(){setExplode(!S.explode)});
$("bBody").addEventListener("click",toggleBody);
$("bView").addEventListener("click",function(){controls.autoRotate=false;homeView()});
$("bUnder").addEventListener("click",function(){controls.autoRotate=false;homeView("below")});
$("bBox").addEventListener("click",function(){controls.autoRotate=false;setBody(2);homeView("box")});
window.addEventListener("keydown",function(e){
  if(e.metaKey||e.ctrlKey||e.altKey)return; var t=e.target; if(t&&(t.tagName==="INPUT"||t.tagName==="TEXTAREA"))return;
  var k=e.key.toLowerCase();
  if(k==="arrowup"){setGas(S.gas+0.05);e.preventDefault()} else if(k==="arrowdown"){setGas(S.gas-0.05);e.preventDefault()}
  else if(k==="p")setSel("P"); else if(k==="r")setSel("R"); else if(k==="n")setSel("N"); else if(k==="d")setSel("D"); else if(k==="m")setSel("M1");
  else if(k==="k")setBrake(!S.brake); else if(k==="h")push(); else if(k==="s")setEngine(!S.engine); else if(k==="f")setFlow(!S.flow);
  else if(k==="e")setExplode(!S.explode); else if(k==="b")toggleBody(); else if(k==="v")homeView(); else if(k==="u")homeView("below"); else if(k==="g"){setBody(2);homeView("box")}
  else if(k>="0"&&k<="9")setFault(FAULTS[+k]);
});

/* ---------- VR: WebXR on Meta Quest ---------- */
renderer.xr.enabled=true; renderer.xr.setReferenceSpaceType("local-floor");
var dolly=new T.Group(); scene.add(dolly); dolly.add(camera);
var vr=new T.Group(); vr.visible=false; dolly.add(vr);
var UPY=new V3(0,1,0), tmpM=new T.Matrix4(), xr=new T.Raycaster(); xr.far=12;
(function(){
  var c=document.createElement("canvas"); c.width=c.height=256; var g=c.getContext("2d");
  var gr=g.createRadialGradient(128,128,10,128,128,128); gr.addColorStop(0,"rgba(105,207,230,0.22)"); gr.addColorStop(0.85,"rgba(105,207,230,0.08)"); gr.addColorStop(1,"rgba(105,207,230,0)");
  g.fillStyle=gr; g.fillRect(0,0,256,256); g.strokeStyle="rgba(105,207,230,0.5)"; g.lineWidth=3; g.beginPath(); g.arc(128,128,112,0,7); g.stroke();
  var m=new T.Mesh(new T.CircleGeometry(0.6,48),new T.MeshBasicMaterial({map:new T.CanvasTexture(c),transparent:true,depthWrite:false,side:T.DoubleSide}));
  m.rotation.x=-Math.PI/2; m.position.y=0.006; vr.add(m);
})();
function panel(wpx,hpx,wm){
  var c=document.createElement("canvas"); c.width=wpx; c.height=hpx;
  var tex=new T.CanvasTexture(c); tex.encoding=T.sRGBEncoding; tex.anisotropy=4;
  var mesh=new T.Mesh(new T.PlaneGeometry(wm,wm*hpx/wpx),new T.MeshBasicMaterial({map:tex,transparent:true,toneMapped:false}));
  mesh.rotation.order="YXZ"; vr.add(mesh);
  return {c:c,g:c.getContext("2d"),tex:tex,mesh:mesh,w:wpx,h:hpx,btn:[]};
}
var CP=panel(1024,1030,0.8), IP=panel(1024,1300,0.84);
function placePanels(){CP.mesh.position.set(-0.6,1.02,-0.6); CP.mesh.rotation.set(-0.38,0.78,0);
  IP.mesh.position.set(0.66,1.3,-0.72); IP.mesh.rotation.set(-0.12,-0.74,0)}
placePanels();
var FS='"IBM Plex Sans",system-ui,sans-serif', FM='"IBM Plex Mono",ui-monospace,monospace', FD='"Barlow Condensed","Arial Narrow",sans-serif';
function rr(g,x,y,w,h,r){g.beginPath();g.moveTo(x+r,y);g.arcTo(x+w,y,x+w,y+h,r);g.arcTo(x+w,y+h,x,y+h,r);g.arcTo(x,y+h,x,y,r);g.arcTo(x,y,x+w,y,r);g.closePath()}
function bg(P){var g=P.g; g.clearRect(0,0,P.w,P.h); rr(g,2,2,P.w-4,P.h-4,26); g.fillStyle="rgba(15,24,43,0.94)"; g.fill(); g.strokeStyle="#27364f"; g.lineWidth=3; g.stroke()}
function wrap(g,t,x,y,mw,lh,max){var w=t.split(" "),line="",n=0;for(var i=0;i<w.length;i++){var tt=line?line+" "+w[i]:w[i];if(g.measureText(tt).width>mw&&line){g.fillText(line,x,y+n*lh);n++;line=w[i];if(n>=max-1&&i<w.length-1){var rest=w.slice(i).join(" ");while(g.measureText(rest+"…").width>mw&&rest.length)rest=rest.slice(0,-1);g.fillText(rest+"…",x,y+n*lh);return n+1}}else line=tt}g.fillText(line,x,y+n*lh);return n+1}
var HOV={};
function drawCtrl(){
  var P=CP, g=P.g, y=26; P.btn=[]; bg(P);
  g.fillStyle="#69cfe6"; g.font="500 20px "+FM; g.textBaseline="top"; g.fillText("VOLVO XC90 2004 · AUTOMATIC",30,y);
  if(window.Copilot&&Copilot.code){g.textAlign="right"; g.fillStyle=Copilot.status==="ON"?"#f0b84a":"#94a3bd"; g.fillText("COPILOT CODE "+Copilot.code+" · "+Copilot.status,P.w-30,y); g.textAlign="left"}
  y+=40;
  function head(t){g.fillStyle="#94a3bd"; g.font="600 19px "+FS; g.fillText(t.toUpperCase(),30,y); y+=30}
  function row(items){var gap=10, x=30, W=P.w-60, n=items.length, bw=(W-gap*(n-1))/n;
    items.forEach(function(it,i){P.btn.push({x:x+i*(bw+gap),y:y,w:bw,h:62,label:it[0],on:it[1],act:it[2],id:it[0]+"|"+y})}); y+=74}
  head("Selector lever");
  row(["P","R","N","D","M1"].map(function(s){return[s==="M1"?"Manual 1":s,S.sel===s,function(){setSel(s)}]}));
  head("Gas "+Math.round(S.gas*100)+" % · brake · push");
  row([["Gas −",false,function(){setGas(S.gas-0.1)}],["Gas +",false,function(){setGas(S.gas+0.1)}],["Gas 0",S.gas===0,function(){setGas(0)}],["Brake",S.brake,function(){setBrake(!S.brake)}],["Push car",S.push>0,push]]);
  head("Fault");
  row(FAULTS.slice(0,5).map(function(fl){return[FSHORT[fl],S.fault===fl,function(){setFault(fl)}]}));
  row(FAULTS.slice(5).map(function(fl){return[FSHORT[fl],S.fault===fl,function(){setFault(fl)}]}));
  head("Model");
  row([["X-ray",S.body===0,function(){setBody(0)}],["Paint",S.body===1,function(){setBody(1)}],["No body",S.body===2,function(){setBody(2)}],[S.explode?"Assemble":"Take apart",S.explode,function(){setExplode(!S.explode)}],["Engine "+(S.engine?"on":"off"),S.engine,function(){setEngine(!S.engine)}],["Reset",false,doReset]]);
  head("Parts");
  var ids=ORDER.filter(function(id){return S.awd||(id!=="angle"&&id!=="haldex")});
  for(var r=0;r<ids.length;r+=6)row(ids.slice(r,r+6).map(function(id){return[nm(SHORT[id]),S.part===id,function(){select(id)}]}));
  head("Your position");
  row([["Front",false,function(){vrView("front")}],["At the gearbox",false,function(){vrView("box")}],["Side",false,function(){vrView("side")}],["On a lift",false,function(){vrView("lift")}],["Exit VR",false,function(){var s=renderer.xr.getSession();if(s)s.end()}]]);
  P.btn.forEach(function(b){
    var hv=HOV[b.id]; rr(g,b.x,b.y,b.w,b.h,12);
    g.fillStyle=b.on?"#e7edf6":hv?"#24375a":"#16233d"; g.fill(); g.lineWidth=hv?4:2; g.strokeStyle=hv?"#69cfe6":b.on?"#e7edf6":"#33456a"; g.stroke();
    g.fillStyle=b.on?"#0b1322":"#e7edf6"; g.font="500 "+(b.label.length>11?18:22)+"px "+FS; g.textAlign="center"; g.textBaseline="middle";
    g.fillText(b.label,b.x+b.w/2,b.y+b.h/2+1); g.textAlign="left"; g.textBaseline="top";
  });
  P.tex.needsUpdate=true;
}
var CHV={hi:1000};
function drawInfo(){
  var P=IP, g=P.g, f=F; bg(P); g.textBaseline="top";
  var msg=statusText(f);
  g.fillStyle=msg[1]?"#ff6a4d":"#e7edf6"; g.font="500 25px "+FM; wrap(g,msg[0],34,28,P.w-68,33,4);
  var cy=170; g.fillStyle="#94a3bd"; g.font="600 19px "+FS; g.fillText("SPEED, LAST 6 S",34,cy);
  g.textAlign="right"; g.font="500 22px "+FM;
  g.fillStyle="#69cfe6"; g.fillText("Wheels "+rpm(f.rpmO),P.w-34,cy-3); g.fillStyle="#e7edf6"; g.fillText("Turbine "+rpm(f.rpmT),P.w-250,cy-3); g.fillStyle="#f0b84a"; g.fillText("Engine "+rpm(f.rpmE),P.w-480,cy-3); g.textAlign="left";
  chartTo(g,88,cy+40,P.w-36,cy+260,CHV,20,4);
  var ry=cy+282, cells=[["Gearbox",boxName(),"#e7edf6"],["Line",f.pl.toFixed(1)+" bar","#f0b84a"],["Clutch",f.drive?f.pc.toFixed(1)+" bar":"–","#f0b84a"],["Moved",cm(f.moved),"#e7edf6"]];
  cells.forEach(function(c,i){var x=34+i*(P.w-68)/4; g.fillStyle="#94a3bd"; g.font="600 17px "+FS; g.fillText(c[0].toUpperCase(),x,ry); g.fillStyle=c[2]; g.font="500 28px "+FM; g.fillText(c[1],x,ry+26)});
  g.save(); g.translate((P.w-546)/2,ry+84); g.scale(2.1,2.1); drawFlowTo(g,260,176,FL.t,9); g.restore();
  var p=PARTS[S.part], py=ry+84+370+24;
  g.fillStyle="#f0b84a"; g.fillRect(34,py,6,P.h-py-34);
  g.fillStyle="#ffffff"; g.font="600 36px "+FD; g.fillText(pName(S.part).toUpperCase(),58,py);
  g.font="600 17px "+FS; g.fillStyle="#94a3bd"; g.fillText("HOW TO EXAMINE IT",58,py+48);
  g.font="400 21px "+FS; g.fillStyle="#e7edf6"; wrap(g,nm(p.check),58,py+74,P.w-100,28,Math.max(1,Math.floor((P.h-40-(py+74))/28)));
  P.tex.needsUpdate=true;
}
var CTR=[];
for(var ci=0;ci<2;ci++)(function(i){
  var c=renderer.xr.getController(i);
  var line=new T.Line(new T.BufferGeometry().setFromPoints([new V3(0,0,0),new V3(0,0,-1)]),new T.LineBasicMaterial({color:0x69cfe6,transparent:true,opacity:0.75}));
  c.add(line);
  var tip=new T.Mesh(new T.ConeGeometry(0.012,0.05,12),new T.MeshBasicMaterial({color:0x69cfe6})); tip.rotation.x=-Math.PI/2; c.add(tip);
  var dot=new T.Mesh(new T.SphereGeometry(0.009,12,8),new T.MeshBasicMaterial({color:0xffffff,depthTest:false})); dot.renderOrder=11; dot.visible=false; scene.add(dot);
  var o={c:c,line:line,dot:dot,src:null,btn:null,part:null,panel:null,hold:null,sq:false,snap:0};
  c.addEventListener("connected",function(e){o.src=e.data});
  c.addEventListener("disconnected",function(){o.src=null});
  c.addEventListener("selectstart",function(){
    var hit=false;
    if(o.btn){o.btn.act(); hit=true} else if(o.part){select(o.part); hit=true}
    if(hit)buzz(o,0.45,30);
  });
  c.addEventListener("squeezestart",function(){o.sq=true; var other=CTR[1-i];
    if(o.panel&&!(other&&other.hold===o.panel)){o.hold=o.panel; o.c.attach(o.panel.mesh); buzz(o,0.35,25)}});
  c.addEventListener("squeezeend",function(){o.sq=false; if(o.hold){vr.attach(o.hold.mesh); o.hold=null; buzz(o,0.2,15)}});
  dolly.add(c); CTR.push(o);
})(ci);
function buzz(o,v,ms){if(o.src&&o.src.gamepad&&o.src.gamepad.hapticActuators&&o.src.gamepad.hapticActuators[0])try{o.src.gamepad.hapticActuators[0].pulse(v,ms)}catch(err){}}
var TWO=null, twoA=new V3(), twoB=new V3();
var bridge=new T.Line(new T.BufferGeometry().setFromPoints([new V3(),new V3()]),new T.LineBasicMaterial({color:0xf0b84a,transparent:true,opacity:0.9,depthTest:false}));
bridge.renderOrder=11; bridge.visible=false; bridge.frustumCulled=false; scene.add(bridge);
var twoTag=(function(){var c=document.createElement("canvas"); c.width=320; c.height=96; var t=new T.CanvasTexture(c); t.encoding=T.sRGBEncoding;
  var sp=new T.Sprite(new T.SpriteMaterial({map:t,depthTest:false,transparent:true,toneMapped:false})); sp.scale.set(0.2,0.06,1); sp.renderOrder=12; sp.visible=false; scene.add(sp); return {s:sp,c:c,t:t,v:-1}})();
function twoHand(){
  var A=CTR[0], B=CTR[1];
  if(A&&B&&A.sq&&B.sq&&!A.hold&&!B.hold&&A.src&&B.src){
    twoA.setFromMatrixPosition(A.c.matrixWorld); twoB.setFromMatrixPosition(B.c.matrixWorld);
    var d=twoA.distanceTo(twoB);
    if(!TWO){TWO={d0:d,k0:S.k,last:-1}; buzz(A,0.3,20); buzz(B,0.3,20)}
    var k=clamp(TWO.k0+(d-TWO.d0)/0.5,0,1);
    if((k===0||k===1)&&k!==TWO.last){buzz(A,0.6,40); buzz(B,0.6,40)}
    TWO.last=k; S.k=k; S.kt=k; if((k>0.5)!==S.explode)explodeLabel(k>0.5);
    var pa=bridge.geometry.attributes.position; pa.setXYZ(0,twoA.x,twoA.y,twoA.z); pa.setXYZ(1,twoB.x,twoB.y,twoB.z); pa.needsUpdate=true; bridge.visible=true;
    twoTag.s.visible=true; twoTag.s.position.lerpVectors(twoA,twoB,0.5).y+=0.06;
    var pc=Math.round(k*100);
    if(pc!==twoTag.v){twoTag.v=pc; var g=twoTag.c.getContext("2d"); g.clearRect(0,0,320,96); rr(g,4,4,312,88,14); g.fillStyle="rgba(11,19,34,0.9)"; g.fill(); g.strokeStyle="#f0b84a"; g.lineWidth=5; g.stroke();
      g.fillStyle="#f0b84a"; g.font="600 40px "+FS; g.textAlign="center"; g.textBaseline="middle"; g.fillText("Apart "+pc+" %",160,50); twoTag.t.needsUpdate=true}
  }else{if(TWO)TWO=null; bridge.visible=false; twoTag.s.visible=false}
}
function vrView(name){
  var V={front:[1.7,0,4.6,0.3,2.9],box:[1.35,-0.35,3.35,0.45,2.95],side:[2.1,0,1.4,0,1.4],lift:[0.9,-2.0,2.4,0,1.5]}[name];
  dolly.position.set(V[0],V[1],V[2]); dolly.rotation.set(0,Math.atan2(-(V[3]-V[0]),-(V[4]-V[2])),0);
}
var hp=new V3(), hd=new V3(), lastDraw=0, ctrlSig="";
function vrUpdate(dt){
  var targets=[CP.mesh,IP.mesh].concat(REG.filter(visibleMesh)); HOV={};
  CTR.forEach(function(o){
    o.btn=null; o.part=null; o.panel=null;
    if(!o.src||!o.c.visible){o.dot.visible=false;return}
    tmpM.identity().extractRotation(o.c.matrixWorld);
    xr.ray.origin.setFromMatrixPosition(o.c.matrixWorld); xr.ray.direction.set(0,0,-1).applyMatrix4(tmpM);
    var h=xr.intersectObjects(targets,false)[0], len=3;
    if(h){len=h.distance; o.dot.visible=true; o.dot.position.copy(h.point);
      if(h.object===CP.mesh)o.panel=CP; else if(h.object===IP.mesh)o.panel=IP;
      if(h.object===CP.mesh&&h.uv){var px=h.uv.x*CP.w, py=(1-h.uv.y)*CP.h;
        CP.btn.forEach(function(b){if(px>=b.x&&px<=b.x+b.w&&py>=b.y&&py<=b.y+b.h){o.btn=b;HOV[b.id]=1}})}
      else if(h.object.userData.part)o.part=h.object.userData.part;
    }else o.dot.visible=false;
    o.line.scale.z=len;
    var gp=o.src.gamepad; if(!gp||gp.axes.length<4)return;
    var ax=gp.axes[2], ay=gp.axes[3]; if(Math.abs(ax)<0.15)ax=0; if(Math.abs(ay)<0.15)ay=0;
    var xc=renderer.xr.getCamera(); hp.setFromMatrixPosition(xc.matrixWorld);
    if(o.src.handedness==="left"){
      hd.set(0,0,-1).transformDirection(xc.matrixWorld); hd.y=0; if(hd.lengthSq()<1e-4)return; hd.normalize();
      dolly.position.addScaledVector(hd,-ay*1.4*dt); dolly.position.x+=-hd.z*ax*1.4*dt; dolly.position.z+=hd.x*ax*1.4*dt;
    }else{
      if(Math.abs(ax)>0.6&&o.snap<=0){var a=(ax>0?-1:1)*Math.PI/6, p=dolly.position.clone().sub(hp); p.applyAxisAngle(UPY,a); dolly.position.copy(hp).add(p); dolly.rotation.y+=a; o.snap=0.35}
      o.snap-=dt; if(Math.abs(ax)<0.3)o.snap=0;
      if(ay)dolly.position.y=clamp(dolly.position.y-ay*0.9*dt,-2.3,1.2);
    }
  });
  twoHand();
  var sig=[window.Copilot?Copilot.code+Copilot.status:"",S.sel,S.gas,S.brake,S.push>0,S.fault,S.body,S.explode,S.engine,S.part,S.awd,S.gb,Object.keys(HOV).join()].join("|");
  if(sig!==ctrlSig){ctrlSig=sig;drawCtrl()}
  lastDraw+=dt; if(lastDraw>0.08){lastDraw=0; drawInfo()}
}
var vrSaved=null;
function vrStart(session){
  S.vr=true; vrSaved=camera.position.clone(); controls.enabled=false; controls.autoRotate=false;
  vr.visible=true;
  if(renderer.xr.setFoveation)renderer.xr.setFoveation(1);
  sun.shadow.mapSize.set(1024,1024); if(sun.shadow.map){sun.shadow.map.dispose();sun.shadow.map=null}
  placePanels(); vrView("front"); ctrlSig=""; drawInfo();
  session.addEventListener("end",vrEnd);
}
function vrEnd(){
  CTR.forEach(function(o){if(o.hold){vr.attach(o.hold.mesh);o.hold=null}o.sq=false}); TWO=null; bridge.visible=false; twoTag.s.visible=false;
  S.vr=false; vr.visible=false; CTR.forEach(function(o){o.dot.visible=false});
  dolly.position.set(0,0,0); dolly.rotation.set(0,0,0);
  sun.shadow.mapSize.set(2048,2048); if(sun.shadow.map){sun.shadow.map.dispose();sun.shadow.map=null}
  controls.enabled=true; if(vrSaved)camera.position.copy(vrSaved); camera.quaternion.identity(); resize(); homeView();
}
var vrOK=false;
if(navigator.xr&&navigator.xr.isSessionSupported){
  navigator.xr.isSessionSupported("immersive-vr").then(function(ok){vrOK=ok;if(ok&&!CO.on)$("bVR").hidden=false}).catch(function(){});
  $("bVR").addEventListener("click",function(){
    if(renderer.xr.isPresenting)return;
    navigator.xr.requestSession("immersive-vr",{optionalFeatures:["local-floor","bounded-floor","hand-tracking"]}).then(function(s){
      return renderer.xr.setSession(s).then(function(){vrStart(s)});
    }).catch(function(err){$("status").textContent="VR did not start: "+(err&&err.message?err.message:err)});
  });
}

function resize(){var w=stage.clientWidth,h=stage.clientHeight;if(!w||!h)return;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix()}
if(window.ResizeObserver)new ResizeObserver(resize).observe(stage); else window.addEventListener("resize",resize);
resize(); homeView(); setBody(0);

var last=0, first=true;
function frame(ts){
  var dt=last?Math.min(0.05,(ts-last)/1000):0.016; last=ts;
  if(CO.on)coFrame(dt); else step(dt);
  S.k+=(S.kt-S.k)*Math.min(1,dt*(reduce?60:(CO.on?18:4)));
  pose(dt*(S.slow?0.3:1));
  if(renderer.xr.isPresenting){vrUpdate(dt); renderer.render(scene,camera)}
  else{if(CO.on&&CO.view==="pilot")coCamera(dt); else controls.update(); renderer.render(scene,camera); readouts(); drawChart(); drawFlow(dt)}
  if(first){first=false;$("loading").style.display="none"}
}

/* ---------- copilot: a second device (for example the MacBook) sees along and changes the options ---------- */
var CO={on:false,view:"free",t:null,vr:false,cam:null,rays:[],sent:0};
function rd(v,n){var f=Math.pow(10,n);return Math.round(v*f)/f}
var _cp=new V3(), _cq=new T.Quaternion(), _cs=new V3(), _cd=new V3();
function coGetState(){
  var n=Math.min(bufN-CO.sent,80), bf=[]; CO.sent=bufN;
  for(var i=BUF.length-n;i<BUF.length;i++)if(i>=0)bf.push(Math.round(BUF[i][0]),Math.round(BUF[i][1]),Math.round(BUF[i][2]));
  var pres=renderer.xr.isPresenting, rays=[];
  if(pres){renderer.xr.getCamera().matrixWorld.decompose(_cp,_cq,_cs);
    CTR.forEach(function(o){if(!o.src||!o.c.visible)return; _cd.setFromMatrixPosition(o.c.matrixWorld);
      var e=o.dot.visible?o.dot.position:_cs.set(0,0,-3).applyMatrix4(o.c.matrixWorld);
      rays.push([rd(_cd.x,3),rd(_cd.y,3),rd(_cd.z,3),rd(e.x,3),rd(e.y,3),rd(e.z,3)])})}
  else{_cp.copy(camera.position); _cq.copy(camera.quaternion)}
  return {s:S.sel,g:S.gas,br:S.brake?1:0,f:S.fault,e:S.engine?1:0,gb:S.gb,aw:S.awd?1:0,b:S.body,k:rd(S.k,3),kt:rd(S.kt,3),sl:S.slow?1:0,pa:S.part,fl:S.flow?1:0,pu:rd(S.push,2),t:rd(S.t,2),
    ph:[PH.we,PH.wt,PH.v,PH.x,PH.xe,PH.pl,PH.pc,PH.te,PH.heat,PH.hcap,PH.tcl,PH.fd,PH.tt,PH.te_,PH.carrier,PH.free].map(function(v){return rd(v,3)}),
    gr:PH.gear,bx:PH.box,en:PH.end?1:0,ht:PH.held?1:0,sa:PH.slipAt,tc:rd(PH.tcap,1),bf:bf,
    cam:[rd(_cp.x,3),rd(_cp.y,3),rd(_cp.z,3),rd(_cq.x,4),rd(_cq.y,4),rd(_cq.z,4),rd(_cq.w,4)],vr:pres?1:0,rays:rays};
}
function coSetState(s){
  if(!s||!s.ph)return;
  APPLY=true;
  try{
    if(s.gb!==S.gb&&GBD[s.gb])setGb(s.gb);
    if(!!s.aw!==S.awd)setAwd(!!s.aw);
    if(s.s!==S.sel&&SHINT[s.s])setSel(s.s);
    if(s.f!==S.fault&&HINTS[s.f])setFault(s.f);
    if(s.g!==S.gas)setGas(s.g);
    if(!!s.br!==S.brake)setBrake(!!s.br);
    if(!!s.e!==S.engine){S.engine=!!s.e; $("engine").textContent="Engine: "+(S.engine?"on":"off"); $("engine").setAttribute("aria-pressed",S.engine?"true":"false")}
    if(s.b!==S.body)setBody(s.b);
    if(!!s.sl!==S.slow)setSlow(!!s.sl);
    if(!!s.fl!==S.flow)setFlow(!!s.fl);
    if(s.pa!==S.part&&PARTS[s.pa])select(s.pa);
    S.kt=s.k; if((s.kt>0.5)!==S.explode)explodeLabel(s.kt>0.5);
    S.push=s.pu;
  }finally{APPLY=false}
  CO.t=s.ph; S.t=s.t;
  PH.gear=s.gr; PH.box=s.bx; PH.end=!!s.en; PH.held=!!s.ht; PH.slipAt=s.sa; PH.tcap=s.tc;
  for(var i=0;i+2<s.bf.length;i+=3){BUF.push([s.bf[i],s.bf[i+1],s.bf[i+2]]); if(BUF.length>300)BUF.shift()}
  CO.cam=s.cam; CO.vr=!!s.vr; CO.rays=s.rays||[];
}
/* the copilot has no physics: it moves smoothly to the last state of the pilot */
function coFrame(dt){
  var t=CO.t; if(!t)return;
  var a=Math.min(1,dt*16);
  PH.we+=(t[0]-PH.we)*a; PH.wt+=(t[1]-PH.wt)*a; PH.v+=(t[2]-PH.v)*a; PH.x+=(t[3]-PH.x)*a; PH.xe+=(t[4]-PH.xe)*a;
  PH.pl+=(t[5]-PH.pl)*a; PH.pc+=(t[6]-PH.pc)*a; PH.te=t[7]; PH.heat=t[8]; PH.hcap=t[9]; PH.tcl=t[10]; PH.fd=t[11]; PH.tt=t[12]; PH.te_=t[13]; PH.carrier=t[14]; PH.free=t[15];
  var G=ratio(), drive=PH.box==="R"||PH.box==="D"||PH.box==="M1", wo=G?PH.v*G/RW:0;
  F={box:PH.box,gear:PH.gear,drive:drive,rpmE:PH.we*RPM,rpmT:Math.max(0,PH.wt*RPM),rpmO:Math.abs(wo*RPM),pl:PH.pl,pc:drive?PH.pc:0,slip:drive&&G?(PH.wt-wo)*RPM:0,slipAt:PH.slipAt,
     held:PH.held,kmh:PH.v*3.6,moved:(PH.x+PH.xe)*100,roll:PH.x*100,brake:S.brake||PH.end,end:PH.end,fd:PH.fd,tcap:PH.tcap,heat:PH.heat,G:G};
  coMarks();
}
var coHead=new T.Group(), coRays=[];
(function(){
  var vis=new T.Mesh(new T.BoxGeometry(0.19,0.1,0.12),new T.MeshStandardMaterial({color:0x1b212c,roughness:0.4,metalness:0.3}));
  var face=new T.Mesh(new T.BoxGeometry(0.17,0.06,0.01),new T.MeshBasicMaterial({color:0x69cfe6})); face.position.z=-0.062;
  var strap=new T.Mesh(new T.TorusGeometry(0.1,0.008,8,24),new T.MeshBasicMaterial({color:0x2a3140})); strap.rotation.x=Math.PI/2; strap.position.z=0.06;
  coHead.add(vis); coHead.add(face); coHead.add(strap); coHead.visible=false; scene.add(coHead);
  for(var i=0;i<2;i++){var l=new T.Line(new T.BufferGeometry().setFromPoints([new V3(),new V3()]),new T.LineBasicMaterial({color:0x69cfe6,transparent:true,opacity:0.9}));
    l.frustumCulled=false; l.visible=false; scene.add(l);
    var dd=new T.Mesh(new T.SphereGeometry(0.012,10,8),new T.MeshBasicMaterial({color:0xffffff})); dd.visible=false; scene.add(dd); coRays.push([l,dd])}
})();
function coMarks(){
  var c=CO.cam, show=CO.on&&CO.vr&&c;
  coHead.visible=!!(show&&CO.view==="free");
  if(show){coHead.position.set(c[0],c[1],c[2]); coHead.quaternion.set(c[3],c[4],c[5],c[6])}
  coRays.forEach(function(p,i){var r=CO.rays[i], on=!!(show&&r); p[0].visible=p[1].visible=on;
    if(on){var a=p[0].geometry.attributes.position; a.setXYZ(0,r[0],r[1],r[2]); a.setXYZ(1,r[3],r[4],r[5]); a.needsUpdate=true; p[1].position.set(r[3],r[4],r[5])}});
}
var _tq=new T.Quaternion();
function coCamera(dt){
  var c=CO.cam; if(!c)return;
  var a=Math.min(1,dt*10);
  camera.position.lerp(_cp.set(c[0],c[1],c[2]),a); camera.quaternion.slerp(_tq.set(c[3],c[4],c[5],c[6]),a);
  var fov=CO.vr?80:36; if(Math.abs(camera.fov-fov)>0.1){camera.fov=fov;camera.updateProjectionMatrix()}
}
function coView(v){
  CO.view=v; var p=v==="pilot"; controls.enabled=!p;
  $("bPilot").setAttribute("aria-pressed",p?"true":"false"); $("bPilot").textContent=p?"Pilot view":"Free view";
  if(!p){camera.fov=36; camera.updateProjectionMatrix(); homeView()}
}
$("bPilot").addEventListener("click",function(){coView(CO.view==="pilot"?"free":"pilot")});
window.addEventListener("keydown",function(e){
  var t=e.target; if(!CO.on||e.metaKey||e.ctrlKey||e.altKey||(t&&(t.tagName==="INPUT"||t.tagName==="TEXTAREA")))return;
  if(e.key.toLowerCase()==="c")coView(CO.view==="pilot"?"free":"pilot");
});
/* pilot: do an action from the copilot. Check each value: a copilot can send anything. */
function coAction(d){
  if(!d||typeof d!=="object"||!window.Copilot||Copilot.role!=="pilot")return;
  var v=d.v;
  if(d.a==="sel"&&SHINT.hasOwnProperty(v))setSel(v);
  else if(d.a==="fault"&&HINTS.hasOwnProperty(v))setFault(v);
  else if(d.a==="gas"&&isFinite(v))setGas(+v);
  else if(d.a==="brake")setBrake(!!v);
  else if(d.a==="push")push();
  else if(d.a==="engine")setEngine(!!v);
  else if(d.a==="gb"&&GBD.hasOwnProperty(v))setGb(v);
  else if(d.a==="awd")setAwd(!!v);
  else if(d.a==="body"&&(v===0||v===1||v===2))setBody(v);
  else if(d.a==="explode")setExplode(!!v);
  else if(d.a==="reset")doReset();
  else if(d.a==="slow")setSlow(!!v);
  else if(d.a==="flow")setFlow(!!v);
  else if(d.a==="part"&&PARTS.hasOwnProperty(v))select(v);
}
function coRole(r){
  CO.on=r==="copilot"; CO.t=null;
  $("bPilot").hidden=!CO.on; $("bVR").hidden=CO.on||!vrOK;
  controls.autoRotate=false;
  if(CO.on){coView("pilot"); $("status").textContent="Copilot: waiting for the pilot."}
  else{coView("free"); coMarks()}
}
if(window.Copilot){
  Copilot.start({name:"xc90trans",rate:20,keys:false,hideKey:"",getState:coGetState,setState:coSetState,role:coRole,message:coAction});
  (function(){var cp=$("copilot-panel"), slot=$("copilotSlot"); if(cp&&slot){cp.classList.remove("cp-small"); slot.appendChild(cp)}})();
}
/* test hook */
window.__xc={drawCtrl:drawCtrl,drawInfo:drawInfo,CP:CP,IP:IP,S:S,PH:PH,F:function(){return F},setSel:setSel,setFault:setFault,setGas:setGas,setBrake:setBrake,push:push,doReset:doReset,setGb:setGb,setAwd:setAwd,step:step,setExplode:setExplode,setBody:setBody,homeView:homeView};
renderer.setAnimationLoop(frame);
})();
