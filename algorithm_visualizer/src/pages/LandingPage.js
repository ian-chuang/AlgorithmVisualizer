import "./LandingPage.css";

export const LandingPage = () => {

  return (
    
    <div className="landingPage">
    <div className="bubbles">

        {/* Navigation Buttons to Algorithms Visualizers */}
        <div id="navigation">
          <button className="btn" onClick={event =>  window.location.href='/sorting'}>Sorting</button>
          <button className="btn" onClick={event =>  window.location.href='/graph'}>Graphs</button>
        </div>

        {/* Title*/}
        <div id="title">
          <span><b>ALGORITHM</b></span><br/>
          <span><b>VISUALIZER</b></span>
        </div>

        {/* Bubbles*/}
        {[...Array(10)].map((e, i) => <div class="bubble" key={i}></div>)}

    </div>
    </div>
  );
}
