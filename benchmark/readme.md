```javascript
Richards: 21.5;
Crypto: 29.8;
RayTrace: 54.7;
NavierStokes: 66.2;
DeltaBlue: 23.7;
```

---

```javascript
Richards: 26.2;
Crypto: 37.2;
RayTrace: 68.2;
NavierStokes: 76.5;
DeltaBlue: 26.9;
```

---

负向优化，撤销，主要是 scope 不 while 获取 parent 值，直接暂存在一个数组里面通过索引去获取

```javascript
Richards: 20.3;
Crypto: 29.4;
RayTrace: 52.0;
NavierStokes: 58.5;
DeltaBlue: 18.6;
```

调整参数格式

```javascript
Richards: 28.6;
Crypto: 39.4;
RayTrace: 53.4;
NavierStokes: 61.8;
DeltaBlue: 31.3;
```

计算指令函数展开，函数参数调用压缩，数组/对象 声明加速

```javascript
Richards: 23.6;
Crypto: 26.9;
RayTrace: 80.7;
NavierStokes: 72.0;
DeltaBlue: 38.7;
```
