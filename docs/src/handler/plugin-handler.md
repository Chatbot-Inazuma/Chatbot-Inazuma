# 插件處理器 (PluginHandler)
繼承EventEmitter類，上限目前設定為100個監聽器。

負責的任務有：  
1. [插件載入](#載入演算法)
2. [監聽所有機器人輸出訊息的事件](#事件列表)

### module.exports

&nbsp;&nbsp;&nbsp;&nbsp;PluginHandler模塊於[Chatbot](../../../src/bot/chatbot.js)對象的建構子中被加載，加載過程中會先建構一個PluginHandler對象，接著將此PluginHandler對象作為Proxy對象建構子的第一個參數，[常數代理](../util/const-proxy.md)對象作為第二個參數，建構並導出此Proxy對象。

### 載入演算法
插件載入的任務在PluginHandler對象建構時被呼叫。
1. 遍歷[src/plugin](../../../src/plugin)下的所有資料夾，每個目錄都須包含一個[info.cson](../plugin/info.cson.md)，才會被視為合法插件。
2. 依照info.cson中module數組的所有項目作為檔名，與info.cson同目錄下依序加載(每一個被加載的js，稱為此插件的模塊)。
3. 插件的模塊所導出的對象或方法會被註冊到PLUGIN_LIST這個屬性中。其結構如下：
```
//結構示意
PLUGIN_LIST{
  plugin_id: {
    module_name: /*被導出的對象或方法*/
  }
}

//調用被導出的對象或方法
this[plugin_id][module_name] = /*被導出的對象或方法*/
```
