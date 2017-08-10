#### [↵ 回上一層](/docs/README.md)
# 常數代理

此對象用於Proxy對象(以下稱為「客體」)建構時的第二個參數，用於代理了第一個參數對象(以下稱為「主體」)的屬性存取。使主體對象可以擁有常數屬性，只需將該屬性以全大寫英文宣告，當該屬性的值受到更改時，會丟出一個IllegalModifyError類的例外。

### 範例
先定義過我們的主客體對象
```
//a.js

let const_proxy = require("./const-proxy")
let master = new ObjectA()
let guest = new Proxy(master, const_proxy)

//導出客體
module.exports = guest
```
主體的類宣告，主體擁有一個屬性叫作CONSTANT，初始值為0。
```
//a.js

class ObjectA{
  constructor(){
    this.CONSTANT = 0;
  }
}
```
如果這時在其他js檔內透過客體修改CONSTANT的值，則丟出IllegalModifyError例外。
```
guest.CONSTANT
//0

guest.CONSTANT = 1
//IllegalModifyError: Property 'CONSTANT' is not modifiable.

guest.CONSTANT
//0
```
