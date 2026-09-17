#!/usr/bin/env node
/**
 * Engine tests.
 *
 * These pin the formula engine to what Google Sheets actually does. Every
 * expected value here was chosen to match real Sheets behaviour, including the
 * awkward corners: MOD with negatives, text sorting after numbers, blanks
 * counting as zero, VLOOKUP's default approximate match.
 */

import { Sheet } from "../src/sheet.js";
import { isError } from "../src/values.js";

let passed = 0;
const failures = [];

const DATA = {
  A1: "Region", B1: "Rep", C1: "Units", D1: "Price", E1: "Date",
  A2: "North", B2: "Ana", C2: 120, D2: 4.5, E2: "2024-01-15",
  A3: "South", B3: "Bo", C3: 80, D3: 4.5, E3: "2024-02-02",
  A4: "North", B4: "Chi", C4: 200, D4: 3.25, E4: "2024-02-19",
  A5: "East", B5: "Dee", C5: 45, D5: 9.99, E5: "2024-03-05",
  A6: "South", B6: "Eze", C6: 160, D6: 4.5, E6: "2024-03-22",
};

function check(formula, expected, label) {
  const sheet = new Sheet({ cells: { ...DATA }, rows: 20, columns: 30 });
  const actual = sheet.evaluateSource(formula, { col: 25, row: 0 });
  const shown = isError(actual) ? actual.type : actual;
  const want = expected;
  const same = typeof want === "number" && typeof shown === "number"
    ? Math.abs(shown - want) < 1e-9
    : JSON.stringify(shown) === JSON.stringify(want);
  if (same) passed += 1;
  else failures.push(`${label || formula}\n      expected ${JSON.stringify(want)}\n      got      ${JSON.stringify(shown)}`);
}

function checkSheet(cells, reference, expected, label) {
  const sheet = new Sheet({ cells: { ...DATA, ...cells }, rows: 20, columns: 30 });
  const actual = sheet.valueAt(reference);
  const shown = isError(actual) ? actual.type : actual;
  const same = typeof expected === "number" && typeof shown === "number"
    ? Math.abs(shown - expected) < 1e-9
    : JSON.stringify(shown) === JSON.stringify(expected);
  if (same) passed += 1;
  else failures.push(`${label}\n      expected ${JSON.stringify(expected)}\n      got      ${JSON.stringify(shown)}`);
}

/* --- arithmetic and precedence --- */
check("1+2*3", 7);
check("(1+2)*3", 9);
check("2^3^2", 512, "^ is right-associative");
check("-2^2", -4, "unary minus binds looser than ^");
check("10/4", 2.5);
check("1/0", "#DIV/0!");
check("50%", 0.5);
check("200*10%", 20);
check('"a"&"b"', "ab");
check('1&2', "12", "& makes text of numbers");
check('"5"+1', 6, "numeric text coerces in arithmetic");
check('"x"+1', "#VALUE!");
check("C2+C3", 200);
check("Z9+1", 1, "a blank cell counts as zero");

/* --- comparison --- */
check("C2>C3", true);
check('"a"="A"', true, "text comparison ignores case");
check("2=2", true);
check("2<>3", true);
check('1="1"', false, "a number never equals text");
check("Z9=0", true, "a blank equals zero");
check('Z9=""', true, "a blank equals empty text");

/* --- core aggregates --- */
check("SUM(C2:C6)", 605);
check("SUM(C2:C6,10)", 615);
check("SUM(A2:A6)", 0, "SUM ignores text");
check("AVERAGE(C2:C6)", 121);
check("COUNT(A2:C6)", 5, "COUNT counts numbers only");
check("COUNTA(A2:C6)", 15);
check("COUNTBLANK(A2:A10)", 4, "A2:A6 hold values, so four of the nine cells are blank");
check("COUNTUNIQUE(A2:A6)", 3);
check("MIN(C2:C6)", 45);
check("MAX(C2:C6)", 200);
check("MEDIAN(C2:C6)", 120);
check("PRODUCT(2,3,4)", 24);
check("SUMPRODUCT(C2:C6,D2:D6)", 120*4.5+80*4.5+200*3.25+45*9.99+160*4.5);
check("LARGE(C2:C6,2)", 160);
check("SMALL(C2:C6,1)", 45);
check("RANK(160,C2:C6)", 2);

/* --- rounding --- */
check("ROUND(2.345,2)", 2.35);
check("ROUND(2.5,0)", 3);
check("ROUND(-2.5,0)", -3, "rounds away from zero");
check("ROUNDUP(2.01,1)", 2.1);
check("ROUNDDOWN(2.99,1)", 2.9);
check("MROUND(17,5)", 15);
check("CEILING(4.1,1)", 5);
check("FLOOR(4.9,1)", 4);
check("INT(-2.5)", -3);
check("MOD(7,3)", 1);
check("MOD(-7,3)", 2, "MOD's sign follows the divisor, as in Sheets");
check("MOD(7,0)", "#DIV/0!");
check("ABS(-4)", 4);
check("SQRT(9)", 3);
check("SQRT(-1)", "#NUM!");
check("POWER(2,10)", 1024);

/* --- logic --- */
check('IF(C2>100,"over","under")', "over");
check('IF(C3>100,"over","under")', "under");
check("IF(TRUE,1)", 1);
check("IF(FALSE,1)", false, "IF with no third argument gives FALSE");
check("IF(Z9=0,0,1/Z9)", 0, "IF does not evaluate the branch it skips");
check('IFS(C5>150,"big",C5>100,"mid",TRUE,"small")', "small");
check('IFS(C4>150,"big",TRUE,"small")', "big");
check("IFS(1=2,1)", "#N/A");
check('SWITCH("b","a",1,"b",2,99)', 2);
check('SWITCH("z","a",1,99)', 99, "a trailing argument is the default");
check("AND(TRUE,TRUE)", true);
check("AND(TRUE,FALSE)", false);
check("OR(FALSE,TRUE)", true);
check("NOT(TRUE)", false);
check("XOR(TRUE,TRUE,TRUE)", true);
check('IFERROR(1/0,"oops")', "oops");
check("IFERROR(5,0)", 5);
check('IFERROR(VLOOKUP("nobody",A2:C6,3,FALSE),"missing")', "missing");
check('IFNA(NA(),"gone")', "gone");
check("ISBLANK(Z9)", true);
check("ISNUMBER(C2)", true);
check("ISTEXT(A2)", true);
check("ISERROR(1/0)", true);
check("ISEVEN(4)", true);
check("ISODD(4)", false);

/* --- conditional aggregates --- */
check('COUNTIF(A2:A6,"North")', 2);
check('COUNTIF(A2:A6,"north")', 2, "criteria ignore case");
check('COUNTIF(C2:C6,">100")', 3);
check('COUNTIF(C2:C6,">=160")', 2);
check('COUNTIF(A2:A6,"*th")', 4, "*th matches both North and South, twice each");
check('COUNTIF(B2:B6,"?o")', 1, "? matches exactly one character");
check('COUNTIF(A2:A6,"<>North")', 3);
check('SUMIF(A2:A6,"North",C2:C6)', 320);
check('SUMIF(C2:C6,">100")', 480, "with no sum range, the tested range is summed");
check('SUMIFS(C2:C6,A2:A6,"South",D2:D6,4.5)', 240);
check('AVERAGEIF(A2:A6,"North",C2:C6)', 160);
check('AVERAGEIF(A2:A6,"West",C2:C6)', "#DIV/0!");
check('COUNTIFS(A2:A6,"North",C2:C6,">150")', 1);
check('MAXIFS(C2:C6,A2:A6,"South")', 160);
check('MINIFS(C2:C6,A2:A6,"North")', 120);

/* --- lookup --- */
check('VLOOKUP("Dee",B2:D6,2,FALSE)', 45);
check('VLOOKUP("Dee",B2:D6,3,FALSE)', 9.99);
check('VLOOKUP("Nobody",B2:D6,2,FALSE)', "#N/A");
check('VLOOKUP("Dee",B2:D6,9,FALSE)', "#REF!");
checkSheet(
  { H1: 0, I1: "F", H2: 50, I2: "C", H3: 80, I3: "B", H4: 90, I4: "A", J1: "=VLOOKUP(85,H1:I4,2)" },
  "J1", "B", "VLOOKUP defaults to an approximate match on sorted data"
);
check('HLOOKUP("Units",C1:E6,3,FALSE)', 80);
check('MATCH("Chi",B2:B6,0)', 3);
check('MATCH("Nobody",B2:B6,0)', "#N/A");
check("INDEX(C2:C6,3)", 200);
check("INDEX(A2:C6,2,3)", 80);
check("INDEX(A2:C6,9,1)", "#REF!");
check('INDEX(C2:C6,MATCH("Eze",B2:B6,0))', 160, "INDEX/MATCH together");
check('XLOOKUP("Bo",B2:B6,C2:C6)', 80);
check('XLOOKUP("Nobody",B2:B6,C2:C6,"none")', "none");
check("ROWS(A1:C6)", 6);
check("COLUMNS(A1:C6)", 3);

/* --- text --- */
check('LEN("hello")', 5);
check('UPPER("abc")', "ABC");
check('LOWER("ABC")', "abc");
check('PROPER("ada lovelace")', "Ada Lovelace");
check('TRIM("  a   b  ")', "a b");
check('LEFT("spreadsheet",6)', "spread");
check('RIGHT("spreadsheet",5)', "sheet");
check('MID("spreadsheet",7,5)', "sheet");
check('FIND("d","spreadsheet")', 6);
check('FIND("D","spreadsheet")', "#VALUE!", "FIND is case-sensitive");
check('SEARCH("D","spreadsheet")', 6, "SEARCH is not");
check('SUBSTITUTE("a-b-c","-","+")', "a+b+c");
check('SUBSTITUTE("a-b-c","-","+",2)', "a-b+c");
check('REPLACE("2024",1,2,"YY")', "YY24");
check('REPT("ab",3)', "ababab");
check('CONCATENATE("a","b","c")', "abc");
check('TEXTJOIN(", ",TRUE,A2:A4)', "North, South, North");
check('TEXTJOIN("-",TRUE,"a","","b")', "a-b", "TRUE skips the empty value");
check('TEXTJOIN("-",FALSE,"a","","b")', "a--b");
check('JOIN(",",A2:A4)', "North,South,North");
check('SPLIT("a,b,c",",")', [["a", "b", "c"]]);
check('VALUE("42")', 42);
check('EXACT("a","A")', false);
check('TEXT(0.256,"0.0%")', "25.6%");
check('TEXT(1234.5,"#,##0.00")', "1,234.50");
check('TEXT(DATE(2024,3,9),"dd/mm/yyyy")', "09/03/2024");
check('TEXT(DATE(2024,3,9),"mmm yyyy")', "Mar 2024");

/* --- dates --- */
check("DATE(2024,1,1)", 45292, "the serial number for 1 January 2024");
check("YEAR(DATE(2024,3,9))", 2024);
check("MONTH(DATE(2024,3,9))", 3);
check("DAY(DATE(2024,3,9))", 9);
check("WEEKDAY(DATE(2024,3,9))", 7, "9 March 2024 was a Saturday");
check("WEEKDAY(DATE(2024,3,9),2)", 6, "type 2 counts Monday as 1");
check("DATE(2024,13,1)", 45658, "month 13 rolls into the next year");
check("EOMONTH(DATE(2024,2,10),0)", 45351, "29 February 2024, a leap year");
check("EDATE(DATE(2024,1,31),1)", 45351, "EDATE clamps to the end of a short month");
check("DAYS(DATE(2024,3,1),DATE(2024,2,1))", 29);
check('DATEDIF(DATE(2000,5,10),DATE(2024,6,17),"Y")', 24);
check('DATEDIF(DATE(2024,1,1),DATE(2024,3,15),"M")', 2);
check("NETWORKDAYS(DATE(2024,3,4),DATE(2024,3,8))", 5, "a full working week");
check("NETWORKDAYS(DATE(2024,3,4),DATE(2024,3,10))", 5, "the weekend does not count");
check("TODAY()", 45460, "TODAY is pinned to 17 June 2024 so exercises are reproducible");
check("YEAR(E2)", 2024, "a date typed as text becomes a real date");

/* --- arrays, spilling and the Google-only tools --- */
check("SEQUENCE(3)", [[1], [2], [3]]);
check("SEQUENCE(2,3)", [[1, 2, 3], [4, 5, 6]]);
check("SEQUENCE(3,1,10,5)", [[10], [15], [20]]);
check("TRANSPOSE(A2:A4)", [["North", "South", "North"]]);
check("UNIQUE(A2:A6)", [["North"], ["South"], ["East"]]);
check("SORT(C2:C6)", [[45], [80], [120], [160], [200]]);
check("SORT(C2:C6,1,FALSE)", [[200], [160], [120], [80], [45]]);
check('FILTER(B2:B6,A2:A6="North")', [["Ana"], ["Chi"]]);
check('FILTER(B2:B6,C2:C6>1000)', "#N/A", "FILTER with no matches reports #N/A");
check("FILTER(B2:C6,C2:C6>150)", [["Chi", 200], ["Eze", 160]]);
check("ARRAYFORMULA(C2:C4*2)", [[240], [160], [400]]);
check("ARRAYFORMULA(UPPER(A2:A4))", [["NORTH"], ["SOUTH"], ["NORTH"]]);
check('ARRAYFORMULA(IF(C2:C4>100,"over","under"))', [["over"], ["under"], ["over"]]);
check("FLATTEN(A2:B3)", [["North"], ["Ana"], ["South"], ["Bo"]]);
check("SUM(ARRAYFORMULA(C2:C6*D2:D6))", 120*4.5+80*4.5+200*3.25+45*9.99+160*4.5);
check("{1,2;3,4}", [[1, 2], [3, 4]]);

/* --- spill behaviour on the sheet --- */
checkSheet({ H1: "=SEQUENCE(3)" }, "H2", 2, "a spilled array fills the cells below");
checkSheet({ H1: "=SEQUENCE(3)" }, "H3", 3, "and keeps filling");
checkSheet({ H1: "=SEQUENCE(3)", H2: "blocked" }, "H1", "#REF!", "a blocked spill reports #REF!");
checkSheet({ H1: "=SEQUENCE(3)", J1: "=SUM(H1:H3)" }, "J1", 6, "other formulas can read spilled cells");
checkSheet({ H1: "=UNIQUE(A2:A6)", I1: "=COUNTA(H1:H3)" }, "I1", 3, "UNIQUE spills three regions");

/* --- QUERY --- */
check('QUERY(A1:E6,"select A, C where C > 100",1)', [["Region", "Units"], ["North", 120], ["North", 200], ["South", 160]]);
check('QUERY(A1:E6,"select sum(C)",1)', [["sum Units"], [605]]);
check('QUERY(A1:E6,"select A, sum(C) group by A",1)', [["Region", "sum Units"], ["East", 45], ["North", 320], ["South", 240]]);
check('QUERY(A1:E6,"select A, sum(C) group by A order by sum(C) desc",1)', [["Region", "sum Units"], ["North", 320], ["South", 240], ["East", 45]]);
check('QUERY(A1:E6,"select B, C order by C desc limit 2",1)', [["Rep", "Units"], ["Chi", 200], ["Eze", 160]]);
check('QUERY(A1:E6,"select B where A = \'North\'",1)', [["Rep"], ["Ana"], ["Chi"]]);
check('QUERY(A1:E6,"select B where A = \'North\' and C > 150",1)', [["Rep"], ["Chi"]]);
check('QUERY(A1:E6,"select B where A = \'East\' or C > 150",1)', [["Rep"], ["Chi"], ["Dee"], ["Eze"]]);
check('QUERY(A1:E6,"select B where B contains \'z\'",1)', [["Rep"], ["Eze"]]);
check('QUERY(A1:E6,"select B where B starts with \'A\'",1)', [["Rep"], ["Ana"]]);
check('QUERY(A1:E6,"select A, sum(C) group by A label A \'Area\', sum(C) \'Total\'",1)', [["Area", "Total"], ["East", 45], ["North", 320], ["South", 240]]);
check('QUERY(A2:C6,"select Col1, Col3 where Col3 > 150",0)', [["North", 200], ["South", 160]]);
check('QUERY(A1:E6,"select avg(C)",1)', [["avg Units"], [121]]);
check('QUERY(A1:E6,"select count(B) where A = \'North\'",1)', [["count Rep"], [2]]);
check('QUERY(A1:E6,"select Q",1)', "#VALUE!", "an out-of-range column is reported");
check('QUERY(A1:E6,"select A pivot B",1)', "#VALUE!", "unsupported clauses say so rather than lying");

/* --- errors and messages --- */
check("SUM(", "#ERROR!");
check("NOTAFUNCTION(1)", "#NAME?");
check("SUM()", "#VALUE!", "too few arguments");
check('VLOOKUP("x",A2:C6)', "#VALUE!");
checkSheet({ H1: "=H1" }, "H1", "#CYCLE!", "a cell referring to itself is caught");
checkSheet({ H1: "=H2", H2: "=H1" }, "H1", "#CYCLE!", "so is a two-cell loop");
check("SUM(C2:C6)/0", "#DIV/0!");
check("IFERROR(SUM(C2:C6)/0,0)", 0, "errors propagate until something catches them");

/* --- whole-column references --- */
check("SUM(C:C)", 605, "a whole-column reference skips the text header");
check('COUNTIF(A:A,"North")', 2);

/* --- recalculation --- */
{
  const sheet = new Sheet({ cells: { ...DATA, H1: "=SUM(C2:C6)" }, rows: 20, columns: 30 });
  const before = sheet.valueAt("H1");
  sheet.setInput("C2", 220);
  const after = sheet.valueAt("H1");
  if (before === 605 && after === 705) passed += 1;
  else failures.push(`recalculation after an edit\n      expected 605 then 705\n      got ${before} then ${after}`);
}

/* --- report --- */
console.log(`${passed} engine checks passed`);
if (failures.length) {
  console.log(`\n${failures.length} FAILED:\n`);
  for (const failure of failures) console.log("  - " + failure + "\n");
  process.exit(1);
}
