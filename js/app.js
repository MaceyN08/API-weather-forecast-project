const findMe = () => {
  

  const success = (position) => {
    console.log(position);
    status.textContent = "success";
    const { latitude, longitude } = position.coords;
    ;
  };
  const error = () => {
    
  };

  navigator.geolocation.getCurrentPosition(success, error);
};
