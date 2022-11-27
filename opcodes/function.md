## function

```javascript
function abc() {
  let a = 4;
  let b = 2;
  let c = (a + b) * 5;
  return c;
}
abc();
```

```
FUNCTION { args: [ 0, false ] }
SETG { args: [ 'abc' ] }
POP {}
LINE { args: [ 8 ] }
GETG { args: [ 'abc', 0 ] }
CALL { args: [ 0, 'abc' ] }
SREXP {}
FUNCTION_SETUP { args: [ true ] }
LINE { args: [ 3 ] }
COLUMN { args: [ 12 ] }
LITERAL { args: [ 4 ] }
SETL { args: [ 0, 3 ] }
SREXP {}
LINE { args: [ 4 ] }
COLUMN { args: [ 12 ] }
LITERAL { args: [ 2 ] }
SETL { args: [ 0, 4 ] }
SREXP {}
LINE { args: [ 5 ] }
COLUMN { args: [ 13 ] }
GETL { args: [ 0, 3 ] }
COLUMN { args: [ 15 ] }
GETL { args: [ 0, 4 ] }
ADD {}
COLUMN { args: [ 18 ] }
LITERAL { args: [ 5 ] }
MUL {}
SETL { args: [ 0, 5 ] }
SREXP {}
LINE { args: [ 6 ] }
COLUMN { args: [ 11 ] }
GETL { args: [ 0, 5 ] }
RETV {}
```

## param

```javascript
function abc(a, b) {
  let c = (a + b) * 5;
  return c;
}
abc(3, 4);
```

```
FUNCTION { args: [ 0, false ] }
SETG { args: [ 'abc' ] }
POP {}
LINE { args: [ 6 ] }
COLUMN { args: [ 4 ] }
LITERAL { args: [ 3 ] }
COLUMN { args: [ 7 ] }
LITERAL { args: [ 4 ] }
COLUMN { args: [ 0 ] }
GETG { args: [ 'abc', 0 ] }
CALL { args: [ 2, 'abc' ] }
SREXP {}
FUNCTION_SETUP { args: [ true ] }
LITERAL { args: [ 0 ] }
GETL { args: [ 0, 1 ] }
GET {}
SETL { args: [ 0, 3 ] }
SREXP {}
LITERAL { args: [ 1 ] }
GETL { args: [ 0, 1 ] }
GET {}
SETL { args: [ 0, 4 ] }
SREXP {}
LINE { args: [ 3 ] }
COLUMN { args: [ 11 ] }
GETL { args: [ 0, 3 ] }
COLUMN { args: [ 15 ] }
GETL { args: [ 0, 4 ] }
ADD {}
COLUMN { args: [ 20 ] }
LITERAL { args: [ 5 ] }
MUL {}
SETL { args: [ 0, 5 ] }
SREXP {}
LINE { args: [ 4 ] }
COLUMN { args: [ 9 ] }
GETL { args: [ 0, 5 ] }
RETV {}
```
