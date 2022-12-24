```javascript
let a = 4;
let b = 1;
let c = (a + b) * 5;
```

```
LINE { args: [ 2 ] }
COLUMN { args: [ 8 ] }
LITERAL { args: [ 4 ] }
SETG { args: [ 'a' ] }
SREXP {}
LINE { args: [ 3 ] }
COLUMN { args: [ 8 ] }
LITERAL { args: [ 1 ] }
SETG { args: [ 'b' ] }
SREXP {}
LINE { args: [ 4 ] }
COLUMN { args: [ 9 ] }
GETG { args: [ 'a', 0 ] }
COLUMN { args: [ 11 ] }
GETG { args: [ 'b', 0 ] }
ADD {}
COLUMN { args: [ 14 ] }
LITERAL { args: [ 5 ] }
MUL {}
SETG { args: [ 'c' ] }
SREXP {}
```
