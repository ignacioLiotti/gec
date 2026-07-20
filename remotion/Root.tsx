import { Composition, Folder } from "remotion";
import { SintesisCommercial } from "./SintesisCommercial";
import { SintesisSaasShowcase } from "./SintesisSaasShowcase";
import { SintesisUseCases, USE_CASES_DURATION_IN_FRAMES } from "./SintesisUseCases";

export const RemotionRoot = () => {
	return (
		<Folder name="Commercial">
			<Composition
				id="SintesisSaasShowcase"
				component={SintesisSaasShowcase}
				durationInFrames={43 * 30}
				fps={30}
				width={1920}
				height={1080}
			/>
			<Composition
				id="SintesisCommercial"
				component={SintesisCommercial}
				durationInFrames={90 * 30}
				fps={30}
				width={1920}
				height={1080}
			/>
			<Composition
				id="SintesisUseCases"
				component={SintesisUseCases}
				durationInFrames={USE_CASES_DURATION_IN_FRAMES}
				fps={30}
				width={1920}
				height={1080}
			/>
		</Folder>
	);
};
