document.addEventListener('DOMContentLoaded', () => {
  SocketClient.connect();
  RoomUI.init();
  GameUI.init();

  document.getElementById('btn-back-home').addEventListener('click', () => {
    RoomUI.goHome();
  });
});
