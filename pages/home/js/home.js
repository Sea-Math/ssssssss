 document.addEventListener("DOMContentLoaded", () => {

            const contentOptions = [
                { text: "love ya sis", image: null },
                { text: "Ronen g the goat???", image: null },
                

                
            ];


            const selectedOption = contentOptions[Math.floor(Math.random() * contentOptions.length)];


            document.getElementById("subtitleText").innerText = selectedOption.text;

  
            if (selectedOption.image !== null) {
                const imgElement = document.getElementById("randomImage");
                imgElement.src = selectedOption.image;
                imgElement.style.display = "block"; 
            }
        });


        window.createSplash = function() {};